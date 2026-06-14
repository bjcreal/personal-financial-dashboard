# These parameters are the contract between Terraform and CDK.
# CDK reads them at synth time via ssm.StringParameter.valueFromLookup()
# and at deploy time via ssm.StringParameter.valueForStringParameter().
# Changing a parameter name here is a breaking change for CDK — update
# superior-stack.ts in lockstep.

locals {
  p = var.ssm_prefix
}

resource "aws_ssm_parameter" "user_pool_id" {
  name  = "${local.p}/user-pool-id"
  type  = "String"
  value = var.user_pool_id
}

resource "aws_ssm_parameter" "user_pool_client_id" {
  name  = "${local.p}/user-pool-client-id"
  type  = "String"
  value = var.user_pool_client_id
}

resource "aws_ssm_parameter" "users_table_name" {
  name  = "${local.p}/users-table-name"
  type  = "String"
  value = var.users_table_name
}

resource "aws_ssm_parameter" "users_table_arn" {
  name  = "${local.p}/users-table-arn"
  type  = "String"
  value = var.users_table_arn
}

resource "aws_ssm_parameter" "plaid_items_table_name" {
  name  = "${local.p}/plaid-items-table-name"
  type  = "String"
  value = var.plaid_items_table_name
}

resource "aws_ssm_parameter" "plaid_items_table_arn" {
  name  = "${local.p}/plaid-items-table-arn"
  type  = "String"
  value = var.plaid_items_table_arn
}

resource "aws_ssm_parameter" "accounts_table_name" {
  name  = "${local.p}/accounts-table-name"
  type  = "String"
  value = var.accounts_table_name
}

resource "aws_ssm_parameter" "accounts_table_arn" {
  name  = "${local.p}/accounts-table-arn"
  type  = "String"
  value = var.accounts_table_arn
}

resource "aws_ssm_parameter" "balances_table_name" {
  name  = "${local.p}/balances-table-name"
  type  = "String"
  value = var.balances_table_name
}

resource "aws_ssm_parameter" "balances_table_arn" {
  name  = "${local.p}/balances-table-arn"
  type  = "String"
  value = var.balances_table_arn
}

resource "aws_ssm_parameter" "transactions_table_name" {
  name  = "${local.p}/transactions-table-name"
  type  = "String"
  value = var.transactions_table_name
}

resource "aws_ssm_parameter" "transactions_table_arn" {
  name  = "${local.p}/transactions-table-arn"
  type  = "String"
  value = var.transactions_table_arn
}
