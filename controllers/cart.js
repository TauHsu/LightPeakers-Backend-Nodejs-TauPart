const { dataSource } = require("../db/data-source");
const redis = require("../utils/redis");
const logger = require("../utils/logger")("CartController");
const { isUndefined, isValidString } = require("../utils/validUtils");
const { validateFields } = require("../utils/validateFields");
const { CARTCHECKOUT_RULES } = require("../utils/validateRules");
const { isUUID } = require("validator");
const AppError = require("../utils/appError");
const ERROR_MESSAGES = require("../utils/errorMessages");

async function getCart(req, res, next) {
  const { id: userId } = req.user;
  const cart = await dataSource
    .getRepository("Cart")
    .createQueryBuilder("cart")
    .leftJoinAndSelect("cart.Products", "Products")
    .where("cart.user_id = :userId", { userId })
    .select([
      "cart.id",
      "cart.price_at_time",
      "cart.quantity",
      "Products.id",
      "Products.name",
      "Products.primary_image",
      "Products.is_available",
    ])
    .getMany();

  const items = cart.map(({ id, Products, price_at_time, quantity }) => {
    return {
      id,
      primary_image: Products?.primary_image || "",
      product_id: Products.id,
      name: Products.name,
      price_at_time,
      quantity,
      total_price: price_at_time * quantity,
      is_available: Products?.is_available,
    };
  });

  const amount = items
    .filter((item) => item.is_available)
    .reduce((sum, item) => sum + item.total_price, 0);

  res.status(200).json({
    status: true,
    data: {
      items,
      amount,
    },
  });
}

async function deleteCartProduct(req, res, next) {
  const { cart_id } = req.params;
  const { id: user_id } = req.user;
  if (isUndefined(cart_id) || !isValidString(cart_id)) {
    logger.warn(ERROR_MESSAGES.FIELDS_INCORRECT);
    return next(new AppError(400, ERROR_MESSAGES.FIELDS_INCORRECT));
  }

  const cartRepo = dataSource.getRepository("Cart");
  const result = await cartRepo.delete({
    id: cart_id,
    user_id: user_id,
  });
  if (result.affected === 0) {
    logger.warn(`購物車商品${ERROR_MESSAGES.DATA_NOT_DELETE}`);
    return next(
      new AppError(400, `購物車商品${ERROR_MESSAGES.DATA_NOT_DELETE}`)
    );
  }

  res.status(200).json({
    status: true,
    message: "刪除成功",
  });
}

async function cleanCart(req, res, next) {
  const { id: user_id } = req.user;
  const cartRepo = dataSource.getRepository("Cart");
  const result = await cartRepo.delete({ user_id: user_id });
  if (result.affected === 0) {
    logger.warn(`購物車${ERROR_MESSAGES.DATA_NOT_DELETE}`);
    return next(new AppError(400, `購物車${ERROR_MESSAGES.DATA_NOT_DELETE}`));
  }

  res.status(200).json({
    status: true,
    message: "購物車清除成功",
  });
}

async function postCartCheckout(req, res, next) {
  const { id: userId } = req.user;
  const {
    shipping_method: shippingMethod,
    payment_method: paymentMethod,
    desired_date: desiredDate,
    coupon_code: couponCode,
  } = req.body;

  const errorFields = validateFields(
    {
      shippingMethod,
      paymentMethod,
      desiredDate,
    },
    CARTCHECKOUT_RULES
  );
  if (errorFields) {
    const errorMessages = errorFields.join(", ");
    logger.warn(errorMessages);
    return next(new AppError(400, errorMessages));
  }

  const couponRepo = dataSource.getRepository("Coupons");
  const orderRepo = dataSource.getRepository("Orders");

  let coupon = null;
  if (couponCode) {
    coupon = await couponRepo.findOneBy({ code: couponCode });

    if (!coupon) {
      logger.warn(`優惠券${ERROR_MESSAGES.DATA_NOT_FOUND}`);
      return next(new AppError(400, `優惠券${ERROR_MESSAGES.DATA_NOT_FOUND}`));
    }

    // 判斷 現在 是否在 該優惠券使用範圍內（包含開始和結束日）
    const now = new Date();
    const startAt = new Date(coupon.start_at);
    const endAt = new Date(coupon.end_at);

    if (now < startAt || now > endAt) {
      logger.warn(ERROR_MESSAGES.COUPON_PERIOD_ERROR);
      return next(new AppError(400, ERROR_MESSAGES.COUPON_PERIOD_ERROR));
    }

    // 此優惠券已使用過
    const usedCoupon = await orderRepo.findOne({
      select: ["id", "user_id", "coupon_id"],
      where: {
        user_id: userId,
        coupon_id: coupon.id,
        status: "已付款",
      },
    });

    if (usedCoupon) {
      logger.warn(`優惠券${ERROR_MESSAGES.DATA_ALREADY_USED}`);
      return next(
        new AppError(400, `優惠券${ERROR_MESSAGES.DATA_ALREADY_USED}`)
      );
    }
  }

  const cacheKey = `checkout:${userId}`;
  const order_draft = {
    user_id: userId,
    shippingMethod,
    paymentMethod,
    desiredDate,
  };
  if (coupon) {
    order_draft.coupon = {
      id: coupon.id,
      code: coupon.code,
      discount: coupon.discount,
    };
  }

  try {
    await redis.set(cacheKey, JSON.stringify(order_draft), { EX: 1800 }); // 30 分鐘
    logger.info(`訂單暫存成功：${cacheKey}`);
  } catch (error) {
    logger.error(ERROR_MESSAGES.REDIS_WRITE_FAILED, error);
    return next(
      new AppError(500, ERROR_MESSAGES.REDIS_FAILED_TO_PROCESS_CHECKOUT)
    );
  }

  return res.status(200).json({
    status: true,
    message: "結帳資料暫存成功",
    data: {
      order_draft,
    },
  });
}

module.exports = {
  getCart,
  deleteCartProduct,
  cleanCart,
  postCartCheckout,
};
