# LightPickers Backend - Tau's Part

你好，我是徐韜。本專案為六角學院專題《拾光堂》的後端開發部分，由我負責主要功能開發與架構設計。
專案為二手攝影器材電商平台，提供完整購物流程與金流整合功能。
[🔗 拾光堂 Node.js Tau's Part](https://github.com/TauHsu/LightPeakers-Backend-Nodejs-TauPart/tree/main)

---

## 我的負責項目

- 系統資料表設計與規劃（TypeORM）
- 建立會員 / 商品 / 購物車 / 訂單 / 金流 / 優惠券 模組 API（共 17 支）
- 串接藍新金流（建立訂單加密請求、接收回傳結果）
- JWT 登入驗證系統實作
- 使用 Redis 快取購物車資料
- 專案會議記錄與技術文件撰寫

---

## 使用技術

- **後端框架**：Node.js + Express
- **資料庫**：PostgreSQL（使用 TypeORM 管理）
- **部署平台**：Render（API）+ Neon（PostgreSQL）+ Redis Cloud
- **身分驗證**：JWT、Bcrypt
- **金流整合**：藍新金流 NewebPay（含 AES 加密 / SHA256）
- **快取**：Redis
- **工具**：dotenv
- **Log 工具**：Pino（搭配 pino-pretty，方便開發時格式化 log）

---

## 專案結構（我負責的後端模組，部分展示）

```bash
LightPeakers-Backend-Nodejs-TauPart/
├── bin/                 # 伺服器啟動程式
│   ├── www.js
├── config/              # 環境與密鑰設定
│   ├── db.js
│   ├── index.js
│   ├── neWebPay.js
│   ├── redisSecret.js
│   ├── web.js
├── controllers/         # API 控制器
│   ├── cart.js
│   ├── orders.js
├── routes/              # 路由定義
│   ├── cart.js
│   ├── orders.js
│   ├── neWebPay.js
├── entities/            # TypeORM 資料模型
│   ├── cart.js
│   ├── Order_items.js
│   ├── Orders.js
│   ├── Payments.js
├── middlewares/         # 中介層處理
│   ├── auth.js
├── utils/               # 工具函式
│   ├── AppError.js
│   ├── errorMessages.js
│   ├── generateJWT.js
│   ├── handleErrorAsync.js
│   ├── logger.js
│   ├── neWebPayCrypto.js
│   ├── redis.js
│   ├── validUtils.js
│   ├── validatePatterns.js
│   ├── validateSignup.js
├── app.js               # Express 應用程式主檔
├── README.md
```

## 資料庫設計

本專案使用 PostgreSQL + TypeORM 管理資料，資料表結構如下：
[🔗 資料表設計圖（dbdiagram.io）](https://dbdiagram.io/d/Light-Peakers-67ea32794f7afba184c42005)

如果您有任何問題或建議，歡迎與我聯繫。感謝閱讀！
