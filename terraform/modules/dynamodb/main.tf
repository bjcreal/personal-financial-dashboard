resource "aws_dynamodb_table" "users" {
  name         = "superior-users-${var.stage}"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_dynamodb_table" "plaid_items" {
  name         = "superior-plaid-items-${var.stage}"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "userId"
  range_key = "itemId"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "itemId"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_dynamodb_table" "accounts" {
  name         = "superior-accounts-${var.stage}"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "userId"
  range_key = "accountId"

  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "accountId"
    type = "S"
  }

  global_secondary_index {
    name            = "accountId-index"
    hash_key        = "accountId"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_dynamodb_table" "balances" {
  name         = "superior-balances-${var.stage}"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "accountId"
  range_key = "dateTimestamp"

  attribute {
    name = "accountId"
    type = "S"
  }
  attribute {
    name = "dateTimestamp"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_dynamodb_table" "transactions" {
  name         = "superior-transactions-${var.stage}"
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "accountId"
  range_key = "datePlaidId"

  attribute {
    name = "accountId"
    type = "S"
  }
  attribute {
    name = "datePlaidId"
    type = "S"
  }
  attribute {
    name = "userId"
    type = "S"
  }
  attribute {
    name = "date"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-date-index"
    hash_key        = "userId"
    range_key       = "date"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }
  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}
