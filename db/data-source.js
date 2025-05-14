const { DataSource } = require("typeorm");
const config = require("../config/index");

const Orders = require("../entities/Orders");
const Order_items = require("../entities/Order_items");
const Payments = require("../entities/Payments");
const Cart = require("../entities/Cart");

const dataSource = new DataSource({
  type: "postgres",
  host: config.get("db.host"),
  port: config.get("db.port"),
  username: config.get("db.username"),
  password: config.get("db.password"),
  database: config.get("db.database"),
  synchronize: config.get("db.synchronize"),
  poolSize: 10,
  entities: [Orders, Order_items, Payments, Cart],
  ssl: config.get("db.ssl"),
});

module.exports = { dataSource };
