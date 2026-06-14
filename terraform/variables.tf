variable "aws_region" {
  type        = string
  description = "AWS region to deploy into"
  default     = "us-east-1"
}

variable "stage" {
  type        = string
  description = "Deployment stage. Defaults to the Terraform workspace name."
  default     = null

  validation {
    condition     = var.stage == null || contains(["dev", "staging", "prod"], coalesce(var.stage, "dev"))
    error_message = "stage must be one of: dev, staging, prod."
  }
}
