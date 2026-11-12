
-- Normalize existing table names to Spring Boot's default
-- lowercase snake_case naming convention.
-- Temporary names avoid case-only rename conflicts.

RENAME TABLE `Account` TO `__tmp_account`;
RENAME TABLE `__tmp_account` TO `account`;

RENAME TABLE `LedgerEntry` TO `__tmp_ledger_entry`;
RENAME TABLE `__tmp_ledger_entry` TO `ledger_entry`;

RENAME TABLE `Savings` TO `__tmp_savings`;
RENAME TABLE `__tmp_savings` TO `savings`;

RENAME TABLE `Transaction` TO `__tmp_transaction`;
RENAME TABLE `__tmp_transaction` TO `transaction`;

RENAME TABLE `User` TO `__tmp_user`;
RENAME TABLE `__tmp_user` TO `user`;
