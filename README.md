# Superior

A self-hosted financial dashboard that aggregates bank accounts, investments, credit cards, loans, and crypto into a single view. Built entirely on serverless AWS infrastructure — no servers to manage, no standing costs when idle.

![AWS Serverless](https://img.shields.io/badge/AWS-Serverless-orange) ![Python](https://img.shields.io/badge/Python-3.13-blue) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![Tests](https://img.shields.io/badge/tests-40%20passing-brightgreen)

## Features

- **Bank & investment account linking** via [Plaid](https://plaid.com) (Chase, Fidelity, Vanguard, and 12,000+ institutions)
- **Crypto portfolio tracking** via Coinbase OAuth — live USD values for all wallet balances
- **Net worth over time** — daily balance snapshots with historical charts
- **Manual accounts** — track real estate, vehicles, or any asset without a Plaid connection
- **Daily automated sync** — EventBridge cron refreshes all balances at 6 AM UTC
- **Multi-user ready** — Cognito authentication with all data strictly scoped per user
- **Transaction history** — sync and browse transactions for any linked account

## Architecture

```
Browser (Next.js on Amplify Hosting)
    │
    ├─ Auth: AWS Cognito (sign-up, sign-in, JWT tokens)
    │
    └─ API: API Gateway → Lambda (FastAPI + Mangum)
                │
                ├─ DynamoDB (5 tables, on-demand billing, PITR enabled)
                ├─ Secrets Manager (Plaid + Coinbase API keys)
                ├─ Plaid API (bank data)
                └─ Coinbase API (crypto data)

EventBridge (cron 6 AM UTC)
    └─ Sync Lambda → Plaid + Coinbase → DynamoDB
```

Infrastructure is split between Terraform (stateful resources) and AWS CDK (application layer). See the [Deployment](#deployment) section for the full flow.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, AWS Amplify |
| Backend | Python 3.13, FastAPI, Mangum, Pydantic |
| Database | DynamoDB (5 tables, PAY_PER_REQUEST, PITR enabled) |
| Auth | AWS Cognito User Pool |
| Infra (stateful) | Terraform — DynamoDB, Cognito, SSM Parameter Store |
| Infra (app layer) | AWS CDK v2 (TypeScript) — Lambda, API Gateway, EventBridge |
| CI/CD | GitHub Actions (tests + Terraform + CDK deploys) |
| Secrets | AWS Secrets Manager |
| Dependency mgmt | Poetry (backend), npm (frontend/CDK) |

---

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) configured (`aws configure`)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.6
- [Node.js 22+](https://nodejs.org/) and npm (for CDK)
- [Docker](https://www.docker.com/) (used by CDK to bundle the Python Lambda)
- [Python 3.13](https://www.python.org/) and [Poetry](https://python-poetry.org/docs/#installation)
- A [Plaid](https://dashboard.plaid.com/signup) developer account (free sandbox tier available)
- A [Coinbase](https://www.coinbase.com/settings/api) OAuth app (optional — only needed for crypto)
- An [AWS Amplify](https://console.aws.amazon.com/amplify/) app connected to your fork (for the frontend)

---

## Deployment

Infrastructure is split between two tools with a clear contract:

- **Terraform** provisions stateful resources (DynamoDB, Cognito) with `prevent_destroy` guards and writes their IDs/ARNs to SSM Parameter Store.
- **CDK** reads from SSM and deploys the application layer (Lambda, API Gateway, EventBridge). It can be torn down and redeployed without touching user data.

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/superior.git
cd superior
```

### 2. Bootstrap Terraform remote state

Create the S3 bucket and DynamoDB lock table once:

```bash
aws s3api create-bucket --bucket YOUR-TF-STATE-BUCKET --region us-east-1
aws s3api put-bucket-versioning \
  --bucket YOUR-TF-STATE-BUCKET \
  --versioning-configuration Status=Enabled
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1
```

Update `terraform/backend.tf` with your bucket name, then:

```bash
cd terraform
terraform init
terraform workspace new prod   # or dev / staging
```

### 3. Store API credentials in AWS Secrets Manager

```bash
# Plaid (required)
aws secretsmanager create-secret \
  --name "superior/plaid" \
  --secret-string '{"client_id":"YOUR_PLAID_CLIENT_ID","secret":"YOUR_PLAID_SECRET"}'

# Coinbase (optional — skip if you don't need crypto tracking)
aws secretsmanager create-secret \
  --name "superior/coinbase" \
  --secret-string '{"client_id":"YOUR_COINBASE_CLIENT_ID","client_secret":"YOUR_COINBASE_CLIENT_SECRET"}'
```

### 4. Deploy stateful infrastructure with Terraform

```bash
cd terraform
terraform apply
```

This provisions DynamoDB tables, the Cognito User Pool, and writes all resource IDs to SSM Parameter Store for CDK to consume.

### 5. Deploy the application layer with CDK

```bash
cd cdk
npm install
cdk bootstrap          # once per account/region
cdk deploy --context stage=prod
```

CDK reads the SSM parameters Terraform wrote, bundles the Python Lambda via Docker, and deploys API Gateway + Lambda + EventBridge. At the end it prints:

```
Outputs:
superior-prod.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

### 6. Deploy the frontend with AWS Amplify

1. Fork this repo and push to your GitHub account.
2. Go to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/) → **New app → Host web app**.
3. Connect your GitHub fork and select the `main` branch.
4. Set the app root to `frontend/`.
5. Add these **environment variables** in the Amplify console:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | CDK output `ApiUrl` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Terraform output `user_pool_id` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Terraform output `user_pool_client_id` |

6. Click **Save and deploy**.

### 7. Verify

```bash
curl https://YOUR_API_URL/health
# → {"status":"ok"}
```

---

## CI/CD (GitHub Actions)

Three workflows are included:

| Workflow | Trigger | What it does |
|---|---|---|
| [`test.yml`](.github/workflows/test.yml) | Every PR + push to `main` | Backend pytest (40 tests) + frontend lint + TypeScript type-check |
| [`deploy-infra.yml`](.github/workflows/deploy-infra.yml) | Push to `main` (terraform/ changes) or manual | Terraform plan + apply |
| [`deploy-app.yml`](.github/workflows/deploy-app.yml) | Push to `main` (backend/ or cdk/ changes) or manual | Tests → CDK deploy |

### Setting up the deploy workflows

Both deploy workflows authenticate via [OIDC](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) — no long-lived AWS keys stored in GitHub.

**Step 1.** Create an IAM OIDC identity provider for GitHub Actions:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**Step 2.** Create an IAM role with the following trust policy (replace placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/superior:*"
      }
    }
  }]
}
```

Attach these managed policies: `AWSCloudFormationFullAccess`, `AWSLambdaFullAccess`, `IAMFullAccess`, `AmazonDynamoDBFullAccess`, `AmazonAPIGatewayAdministrator`, `AmazonCognitoPowerUser`, `SecretsManagerReadWrite`, `AmazonSSMReadOnlyAccess`.

**Step 3.** Add the role ARN as a GitHub Actions secret named `AWS_DEPLOY_ROLE_ARN`.

---

## Local Development

### Backend

```bash
cd backend
poetry install
poetry run pytest              # run all 40 tests
poetry run pytest -v -k plaid  # run a specific module
```

Tests use [moto](https://github.com/getmoto/moto) to mock DynamoDB and Secrets Manager — no AWS credentials or internet connection needed.

### Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
npm test       # Jest unit tests
npm run lint   # ESLint + type-check
```

Create `frontend/.env.local` with:

```bash
NEXT_PUBLIC_API_URL=https://YOUR_API_URL
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + Mangum Lambda handler
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── dependencies.py      # Auth + AWS client injection
│   │   ├── models/              # Pydantic request/response models
│   │   ├── routers/             # FastAPI route handlers
│   │   │   ├── accounts.py
│   │   │   ├── plaid.py
│   │   │   ├── crypto.py
│   │   │   └── health.py
│   │   └── services/            # Business logic
│   │       ├── dynamodb.py
│   │       ├── plaid.py
│   │       ├── coinbase.py
│   │       └── secrets.py
│   ├── sync/
│   │   └── handler.py           # EventBridge daily sync Lambda
│   ├── tests/                   # pytest suite (40 tests, moto mocks)
│   └── pyproject.toml           # Poetry dependencies
├── cdk/                         # AWS CDK (TypeScript) — application layer
│   ├── bin/app.ts               # CDK app entry point
│   └── lib/
│       ├── config.ts            # Stage configuration
│       ├── constructs/
│       │   └── python-function.ts  # Reusable Poetry-bundled Lambda construct
│       └── stacks/
│           └── superior-stack.ts   # Lambda + API GW + EventBridge
├── terraform/                   # Terraform — stateful infrastructure
│   ├── backend.tf               # S3 remote state + DynamoDB lock
│   ├── main.tf                  # Module composition
│   ├── locals.tf                # Workspace-based stage resolution
│   └── modules/
│       ├── dynamodb/            # 5 DynamoDB tables (prevent_destroy=true)
│       ├── cognito/             # Cognito User Pool + Client
│       └── ssm_outputs/         # SSM params consumed by CDK
├── frontend/
│   └── src/
│       ├── app/                 # Next.js App Router pages
│       ├── components/          # React components
│       ├── lib/                 # API client, Amplify config, account types
│       └── __tests__/           # Jest unit tests
└── .github/workflows/
    ├── test.yml                 # CI: tests on every PR
    ├── deploy-infra.yml         # CD: Terraform apply on terraform/ changes
    └── deploy-app.yml           # CD: CDK deploy on backend/ or cdk/ changes
```

---

## Cost Estimate

For a single user at low usage, this runs near-free:

| Service | Estimated monthly cost |
|---|---|
| Lambda + API Gateway | Free tier |
| DynamoDB | Free tier (< 25 GB, < 200M requests) |
| Cognito | Free tier (up to 50,000 MAUs) |
| Secrets Manager | ~$0.80 (2 secrets × $0.40) |
| Amplify Hosting | Free tier |

**Total: ~$0.80/month** after free tier.

---

## License

MIT
