-- CreateIndex
CREATE INDEX "MenuItem_deletedAt_isHidden_idx" ON "MenuItem"("deletedAt", "isHidden");

-- CreateIndex
CREATE INDEX "UserStore_userId_idx" ON "UserStore"("userId");
