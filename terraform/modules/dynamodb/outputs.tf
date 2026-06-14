output "users_table_name"        { value = aws_dynamodb_table.users.name }
output "users_table_arn"         { value = aws_dynamodb_table.users.arn }

output "plaid_items_table_name"  { value = aws_dynamodb_table.plaid_items.name }
output "plaid_items_table_arn"   { value = aws_dynamodb_table.plaid_items.arn }

output "accounts_table_name"     { value = aws_dynamodb_table.accounts.name }
output "accounts_table_arn"      { value = aws_dynamodb_table.accounts.arn }

output "balances_table_name"     { value = aws_dynamodb_table.balances.name }
output "balances_table_arn"      { value = aws_dynamodb_table.balances.arn }

output "transactions_table_name" { value = aws_dynamodb_table.transactions.name }
output "transactions_table_arn"  { value = aws_dynamodb_table.transactions.arn }
