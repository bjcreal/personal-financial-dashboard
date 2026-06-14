terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 with DynamoDB locking.
  # Bootstrap these resources once before first `terraform init`:
  #
  #   aws s3api create-bucket \
  #     --bucket YOUR-TERRAFORM-STATE-BUCKET \
  #     --region us-east-1
  #
  #   aws s3api put-bucket-versioning \
  #     --bucket YOUR-TERRAFORM-STATE-BUCKET \
  #     --versioning-configuration Status=Enabled
  #
  #   aws dynamodb create-table \
  #     --table-name terraform-state-lock \
  #     --attribute-definitions AttributeName=LockID,AttributeType=S \
  #     --key-schema AttributeName=LockID,KeyType=HASH \
  #     --billing-mode PAY_PER_REQUEST \
  #     --region us-east-1
  #
  backend "s3" {
    bucket         = "YOUR-TERRAFORM-STATE-BUCKET"
    key            = "superior/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "superior"
      Stage     = local.stage
      ManagedBy = "terraform"
    }
  }
}
