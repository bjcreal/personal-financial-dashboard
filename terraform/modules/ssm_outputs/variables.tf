variable "ssm_prefix" {
  type        = string
  description = "SSM Parameter Store path prefix (e.g. /superior/prod)"
}

variable "user_pool_id"        { type = string }
variable "user_pool_client_id" { type = string }

variable "users_table_name"        { type = string }
variable "users_table_arn"         { type = string }
variable "plaid_items_table_name"  { type = string }
variable "plaid_items_table_arn"   { type = string }
variable "accounts_table_name"     { type = string }
variable "accounts_table_arn"      { type = string }
variable "balances_table_name"     { type = string }
variable "balances_table_arn"      { type = string }
variable "transactions_table_name" { type = string }
variable "transactions_table_arn"  { type = string }
