Below is an example **README** that gives new contributors (or stakeholders) a high-level overview of the **business logic** (restaurant context, sessions, orders) and the **tech stack** (NestJS + Prisma + S3, etc.). You can adapt it as needed for your specific project details.

---

# Restaurant Ordering System

This repository is a **NestJS-based** application for managing **table sessions** in a restaurant, creating & paying **orders**, and **uploading images** (e.g., for menu items).

## 1. Business Logic Overview

1. **Table Sessions**

   - Each physical table can have multiple sessions over time.
   - A session is created when new diners arrive. It’s identified by a unique `sessionUuid`.
   - Orders belong to a particular session. Once **all** orders in that session are paid, the session is automatically closed.

2. **Menu Items & Orders**

   - Menu items are created/updated by **OWNER** or **ADMIN** roles.
   - When a customer is seated (i.e., a table session is active), they can place orders for that session.
   - Each **Order** can have multiple **OrderItems**; once paid, the order is marked “paid.”
   - If all orders in a session are paid, the table session is closed.

3. **Image Uploads**

   - We have a **common upload** endpoint (`POST /upload`) that uploads a file to **Amazon S3**.
   - The system can generate a unique image key (e.g., `uploads/<uuid>`) and store it in the DB for referencing images in menu items or other resources.

4. **Auto-Cleanup**
   - A scheduled job runs weekly to remove unused images from S3 if they’re no longer referenced in the database.

### Typical Flow

1. **Admin** sets up menu items with names, base price, optional variations (e.g., sizes, add-ons).
2. **Customers** arrive, a new **TableSession** is created for their table.
3. **Customers** place one or more **Orders** in that session. Each order has items.
4. **Checkout** (pay) an order. Once all orders for the session are paid, the system **auto-closes** the session.

---

## 2. Tech Stack

1. **NestJS**

   - A progressive Node.js framework for building efficient and scalable server-side applications.
   - We use Nest modules to organize features (e.g., `MenuModule`, `OrderModule`, `TableSessionModule`, `CommonModule`).

2. **Prisma**

   - ORM for TypeScript/JavaScript, providing a **type-safe** and easy approach to database interactions.
   - We define our data models (e.g., `TableSession`, `Order`, `MenuItem`) in `schema.prisma` and generate the Prisma client.

3. **AWS S3**

   - Used to store uploaded images (like menu item photos).
   - The **S3Service** handles listing, uploading, and deleting files.
   - A **weekly job** auto-removes orphaned images.

4. **PostgreSQL/MySQL** (or any DB that Prisma supports)

   - Our database that stores all the restaurant data: tables, sessions, orders, items, etc.
   - Migrations and schema evolution are managed via Prisma.

5. **JWT Auth**
   - We rely on **JWT** for user authentication.
   - Roles like OWNER, ADMIN, SALE, CHEF define who can create or update resources.

---

## 3. Repository Structure

- **`/src/common`**

  - **`infra/s3.service.ts`**: The S3Service for uploading & deleting files on AWS.
  - **`upload/upload.service.ts`**: Logic for handling file uploads (possibly resizing images).
  - **`upload/upload.controller.ts`**: A generic endpoint for image/file uploads.

- **`/src/menu`**

  - **`menu.controller.ts`**: Endpoints for creating/updating/deleting menu items; reading them.
  - **`menu.service.ts`**: Business logic for menu items (price, variations, etc.).
  - **`dto`** folder: e.g., `create-menu-item.dto.ts`.

- **`/src/table-session`**

  - **`table-session.controller.ts`**: Create/close sessions, retrieve session by UUID.
  - **`table-session.service.ts`**: DB logic (status updates, auto-closing, etc.).

- **`/src/order`**

  - **`order.controller.ts`**: For creating orders & checkout (pay) an order.
  - **`order.service.ts`**: Contains the logic for item additions, marking orders “paid,” auto-closing the session if all orders are paid.

- **`prisma/schema.prisma`**

  - The data model definitions (e.g., `TableSession`, `MenuItem`, `Order`, `OrderItem`).

- **`/src/cleanup`**

  - **`unused-image-cleanup.service.ts`**: A scheduled job that runs weekly to remove S3 objects not referenced in the DB.

- **`app.module.ts`**
  - Root module that imports other modules (like `TableSessionModule`, `MenuModule`, `OrderModule`, `CommonModule`).

---

## 4. Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```
2. **Configure Environment**
   - `.env` file with DB connection (`DATABASE_URL`), AWS S3 credentials, etc.
   ```
   AWS_S3_REGION=...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_S3_BUCKET=...
   ```
3. **Prisma Migrate**
   ```bash
   npx prisma migrate dev
   ```
4. **Run the App**
   ```bash
   npm run start:dev
   ```
5. **Swagger Docs**
   - If you enable them in `main.ts`, open `http://localhost:3000/api-docs`.

---

## 5. Key Endpoints

1. **Table Sessions**

   - `POST /table-sessions` → Create session.
   - `GET /table-sessions/:uuid` → Retrieve session.
   - `PATCH /table-sessions/:id` → Update session (close or other status).

2. **Menu Items**

   - `GET /menu?shopId=...` → Public listing of items.
   - `POST /menu` → Create item (OWNER/ADMIN).
   - `PUT /menu/:id` → Update item.
   - `DELETE /menu/:id` → Delete item.

3. **Orders**

   - `POST /orders/create` → Create order for a session.
   - `POST /orders/checkout` → Pay an order (auto-close session if all orders are paid).

4. **Images**
   - `POST /upload` → Generic image upload, returning S3 keys.
   - Weekly job removes orphaned images from S3 if not found in DB references.

---

## 6. Contributing

1. **Fork** the repo & create a branch for new features/fixes.
2. **Update** the `prisma/schema.prisma` if you need new models or changes. Then run `prisma migrate`.
3. **Write** or update unit/integration tests.
4. **Submit** a PR for review.

---

## 7. Further Notes

- **Auto-Close Logic**: Once an order is “paid,” the system checks if **all** orders for that table session are paid. If so, it sets `TableSession.status = 'closed'`.
- **Extensibility**: You can easily add new roles, add discount logic, multiple branches/shops, or advanced seat management if needed.
- **Authentication**: Adjust your NestJS guards for each endpoint to ensure correct user roles can create/close table sessions, edit menu items, etc.

---

**Enjoy building and maintaining this restaurant ordering system!** If you have any questions, refer to the **Swagger docs** or the code in `/src`.
