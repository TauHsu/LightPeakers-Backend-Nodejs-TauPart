const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const redis = require("../utils/redis");
const logger = require("../utils/logger")("OrdersController");
const { isUndefined, isValidString } = require("../utils/validUtils");
const {
  create_mpg_aes_encrypt,
  create_mpg_sha_encrypt,
} = require("../utils/neWebPayCrypto");
const AppError = require("../utils/appError");
const ERROR_MESSAGES = require("../utils/errorMessages");

async function postOrder(req, res, next) {
  const { id: userId } = req.user;
  const { cart_ids } = req.body;

  if (!isValidStringArray(cart_ids)) {
    logger.warn(ERROR_MESSAGES.FIELDS_INCORRECT);
    return next(new AppError(400, ERROR_MESSAGES.FIELDS_INCORRECT));
  }

  const data = await redis.get(`checkout:${userId}`);
  if (!data) {
    return next(new AppError(400, ERROR_MESSAGES.FINISH_CHECKOUT_FIRST));
  }
  const checkoutData = JSON.parse(data);

  // 檢查是否已有 未付款的相同商品訂單
  const carts = await dataSource.getRepository("Cart").find({
    where: { id: In(cart_ids) },
  });
  const productIds = carts.map((cart) => cart.product_id);

  const existingOrder = await dataSource
    .getRepository("Orders")
    .createQueryBuilder("order")
    .innerJoin("Order_items", "item", "item.order_id = order.id")
    .where("order.user_id = :userId", { userId })
    .andWhere("order.status = :status", { status: "待付款" })
    .andWhere("item.product_id IN (:...productIds)", { productIds })
    .getOne();

  if (existingOrder) {
    logger.warn(ERROR_MESSAGES.ORDER_ALREADY_USED_PLEASE_PAY_FIRST);
    return next(
      new AppError(400, ERROR_MESSAGES.ORDER_ALREADY_USED_PLEASE_PAY_FIRST)
    );
  }

  let newOrder;

  await dataSource.transaction(async (manager) => {
    const cartRepo = manager.getRepository("Cart");
    const orderRepo = manager.getRepository("Orders");
    const orderItemsRepo = manager.getRepository("Order_items");

    // 計算付款總額 amount
    const result = await cartRepo
      .createQueryBuilder("cart")
      .select("SUM(cart.price_at_time)", "total")
      .where("cart.id IN (:...ids)", { ids: cart_ids })
      .getRawOne();

    let amount = Number(result.total) || 0;

    //建立 Order 資料
    newOrder = await orderRepo.create({
      user_id: userId,
      status: "待付款",
      desired_date: checkoutData.desiredDate,
      shipping_method: checkoutData.shippingMethod,
      payment_method: checkoutData.paymentMethod,
      amount,
    });

    if (checkoutData.coupon) {
      newOrder.coupon_id = checkoutData.coupon.id;
      newOrder.amount = Math.round(
        (amount / 10) * checkoutData.coupon.discount
      );
      // 將使用的優惠券數量 -1
      const couponRepo = manager.getRepository("Coupons");
      const usingCoupon = await couponRepo.findOneBy({
        id: newOrder.coupon_id,
      });
      console.log(usingCoupon);
      usingCoupon.quantity -= 1;
      await couponRepo.save(usingCoupon);
    }

    newOrder.amount += 60; // 最後價格加上運費 60

    await orderRepo.save(newOrder);

    // 將 cart 品項整理好，存入 Order_items
    const carts = await cartRepo.find({
      where: { id: In(cart_ids) },
    });
    const orderItemsData = carts.map((cart) => ({
      order_id: newOrder.id,
      product_id: cart.product_id,
      quantity: cart.quantity || 1,
      price: cart.price_at_time,
    }));
    await orderItemsRepo.save(orderItemsData);
  });

  await redis.del(`checkout:${userId}`);

  const cartRepo = dataSource.getRepository("Cart");

  // 藍新金流
  const Email = await dataSource.getRepository("Users").findOne({
    select: ["email"],
    where: { id: userId },
  });
  const cartItem = await cartRepo.findOne({
    select: ["product_id"],
    where: { id: cart_ids[0] },
  });
  const productId = cartItem.product_id;
  const productName = await dataSource.getRepository("Products").findOne({
    select: ["name"],
    where: { id: productId },
  });
  const ItemDesc = `${productName.name}...等，共${cart_ids.length}項商品`;
  const TimeStamp = Math.round(new Date().getTime() / 1000);
  const neWedPayOrder = {
    Email: Email.email,
    Amt: newOrder.amount,
    ItemDesc,
    TimeStamp,
    MerchantOrderNo: TimeStamp,
  };

  // 儲存 neWedPayOrder 至該訂單
  newOrder.merchant_order_no = TimeStamp;
  await dataSource.getRepository("Orders").save(newOrder);

  const aesEncrypt = create_mpg_aes_encrypt(neWedPayOrder);
  const shaEncrypt = create_mpg_sha_encrypt(aesEncrypt);

  const htmlForm = ` 
    <form id="newebpay-form" action="https://ccore.newebpay.com/MPG/mpg_gateway" method="post" style="display: none;">
      <input type="hidden" name="MerchantID" value="${config.get(
        "neWebPaySecret.merchantId"
      )}">
      <input type="hidden" name="TradeSha" value="${shaEncrypt}">
      <input type="hidden" name="TradeInfo" value="${aesEncrypt}">
      <input type="hidden" name="TimeStamp" value="${neWedPayOrder.TimeStamp}">
      <input type="hidden" name="Version" value="${config.get(
        "neWebPaySecret.version"
      )}">
      <input type="hidden" name="MerchantOrderNo" value="${
        neWedPayOrder.MerchantOrderNo
      }">
      <input type="hidden" name="Amt" value="${neWedPayOrder.Amt}">
      <input type="hidden" name="ItemDesc" value="${neWedPayOrder.ItemDesc}">
      <input type="hidden" name="Email" value="${neWedPayOrder.Email}">
      <button type="submit">送出</button>
    </form>
    <script>document.getElementById("newebpay-form").submit();</script>`;

  res.status(200).type("html").send(htmlForm);
}

async function getPaidOrder(req, res, next) {
  const { order_id } = req.params;
  ㄔ;
  const { id: user_id } = req.user;
  // 檢查用戶是否有權限
  const userBanned = await dataSource.getRepository("Users").findOne({
    select: ["is_banned"],
    where: { id: user_id },
  });
  if (userBanned) {
    logger.warn(ERROR_MESSAGES.NOT_AUTHORIZED_FOR_ORDER);
    return next(new AppError(403, ERROR_MESSAGES.NOT_AUTHORIZED_FOR_ORDER));
  }

  // 檢查資料庫有無此訂單
  const orderRepo = dataSource.getRepository("Orders");
  const order = await orderRepo.findOneBy({ id: order_id });
  if (!order) {
    logger.warn(`訂單${ERROR_MESSAGES.DATA_NOT_FOUND}`);
    return next(new AppError(404, `訂單${ERROR_MESSAGES.DATA_NOT_FOUND}`));
  }

  res.status(200).json({
    status: true,
    message: "訂單取得成功",
    data: {
      id: order.id,
      user_id: order.user_id,
      merchant_order_no: order.merchant_order_no,
      status: order.status,
      amount: order.amount,
      created_at: order.created_at,
    },
  });
}

module.exports = {
  postOrder,
  getPaidOrder,
};
