locals {
  # Use explicit var.stage if set, otherwise fall back to the Terraform workspace name.
  # Workspaces let you manage dev/staging/prod from one config:
  #   terraform workspace new prod
  #   terraform workspace select prod
  #   terraform apply
  stage = coalesce(var.stage, terraform.workspace == "default" ? "prod" : terraform.workspace)

  ssm_prefix = "/superior/${local.stage}"
}
