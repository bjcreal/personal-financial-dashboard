module "dynamodb" {
  source = "./modules/dynamodb"
  stage  = local.stage
}

module "cognito" {
  source = "./modules/cognito"
  stage  = local.stage
}

# Write all cross-stack outputs to SSM so CDK can reference them
# without hardcoding values or creating circular dependencies.
module "ssm_outputs" {
  source = "./modules/ssm_outputs"

  ssm_prefix = local.ssm_prefix

  user_pool_id        = module.cognito.user_pool_id
  user_pool_client_id = module.cognito.user_pool_client_id

  users_table_name        = module.dynamodb.users_table_name
  users_table_arn         = module.dynamodb.users_table_arn
  plaid_items_table_name  = module.dynamodb.plaid_items_table_name
  plaid_items_table_arn   = module.dynamodb.plaid_items_table_arn
  accounts_table_name     = module.dynamodb.accounts_table_name
  accounts_table_arn      = module.dynamodb.accounts_table_arn
  balances_table_name     = module.dynamodb.balances_table_name
  balances_table_arn      = module.dynamodb.balances_table_arn
  transactions_table_name = module.dynamodb.transactions_table_name
  transactions_table_arn  = module.dynamodb.transactions_table_arn
}
