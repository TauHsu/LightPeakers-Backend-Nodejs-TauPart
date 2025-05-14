const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const cartController = require("../controllers/cart");
const handleErrorAsync = require("../utils/handleErrorAsync");

router.get("/", auth, handleErrorAsync(cartController.getCart));
router.delete(
  "/:cart_id",
  auth,
  handleErrorAsync(cartController.deleteCartProduct)
);
router.delete("/", auth, handleErrorAsync(cartController.cleanCart));
router.post(
  "/checkout",
  auth,
  handleErrorAsync(cartController.postCartCheckout)
);

module.exports = router;
