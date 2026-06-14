output "user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.cognito.user_pool_client_id
}

output "users_table_name"        { value = module.dynamodb.users_table_name }
output "plaid_items_table_name"  { value = module.dynamodb.plaid_items_table_name }
output "accounts_table_name"     { value = module.dynamodb.accounts_table_name }
output "balances_table_name"     { value = module.dynamodb.balances_table_name }
output "transactions_table_name" { value = module.dynamodb.transactions_table_name }

output "ssm_prefix" {
  description = "SSM Parameter Store path prefix used by CDK"
  value       = local.ssm_prefix
}
