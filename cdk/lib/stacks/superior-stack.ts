import * as path from 'path';
import { Construct } from 'constructs';
import {
  Stack,
  StackProps,
  Duration,
  CfnOutput,
} from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { PythonPoetryFunction } from '../constructs/python-function';
import { StageConfig } from '../config';

export interface SuperiorStackProps extends StackProps {
  readonly stage: StageConfig;
}

/**
 * Application infrastructure for Superior.
 *
 * Stateful resources (DynamoDB, Cognito, Secrets Manager) are managed by
 * Terraform and referenced here via SSM Parameter Store. This stack owns
 * only the compute and routing layer — Lambda, API Gateway, EventBridge —
 * which can be safely torn down and redeployed without data loss.
 */
export class SuperiorStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: SuperiorStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const ssm_prefix = `/superior/${stage.name}`;
    const backendDir = path.join(__dirname, '../../../..', 'backend');

    // ── SSM lookups (resolved at synth time, requires AWS credentials) ────────
    // These parameters are written by Terraform after it provisions the stateful
    // resources. Run `terraform apply` before `cdk deploy`.

    const userPoolId = ssm.StringParameter.valueFromLookup(
      this, `${ssm_prefix}/user-pool-id`
    );

    // deploy-time SSM references (CloudFormation dynamic resolution)
    const userPoolClientId = ssm.StringParameter.valueForStringParameter(
      this, `${ssm_prefix}/user-pool-client-id`
    );

    const tableNames = {
      users:        ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/users-table-name`),
      plaidItems:   ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/plaid-items-table-name`),
      accounts:     ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/accounts-table-name`),
      balances:     ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/balances-table-name`),
      transactions: ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/transactions-table-name`),
    };

    const tableArns = {
      users:        ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/users-table-arn`),
      plaidItems:   ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/plaid-items-table-arn`),
      accounts:     ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/accounts-table-arn`),
      balances:     ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/balances-table-arn`),
      transactions: ssm.StringParameter.valueForStringParameter(this, `${ssm_prefix}/transactions-table-arn`),
    };

    // ── Shared IAM policies ───────────────────────────────────────────────────

    const allTableResources = [
      ...Object.values(tableArns),
      ...Object.values(tableArns).map(arn => `${arn}/index/*`),
    ];

    const fullDynamoPolicy = new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        'dynamodb:BatchWriteItem', 'dynamodb:BatchGetItem',
      ],
      resources: allTableResources,
    });

    const syncTableArns = [
      tableArns.plaidItems, tableArns.accounts, tableArns.balances, tableArns.transactions,
      `${tableArns.plaidItems}/index/*`, `${tableArns.accounts}/index/*`,
      `${tableArns.balances}/index/*`,   `${tableArns.transactions}/index/*`,
    ];

    const syncDynamoPolicy = new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        'dynamodb:BatchWriteItem',
      ],
      resources: syncTableArns,
    });

    const secretsPolicy = new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:superior/*`,
      ],
    });

    // ── Shared Lambda environment variables ───────────────────────────────────

    const sharedEnv: Record<string, string> = {
      STAGE:              stage.name,
      PLAID_ENV:          stage.plaidEnv,
      USERS_TABLE:        tableNames.users,
      PLAID_ITEMS_TABLE:  tableNames.plaidItems,
      ACCOUNTS_TABLE:     tableNames.accounts,
      BALANCES_TABLE:     tableNames.balances,
      TRANSACTIONS_TABLE: tableNames.transactions,
    };

    // ── API Lambda ────────────────────────────────────────────────────────────

    const apiFunction = new PythonPoetryFunction(this, 'ApiFunction', {
      functionName:  `superior-api-${stage.name}`,
      entry:         backendDir,
      handler:       'app.main.handler',
      timeout:       Duration.seconds(30),
      memorySize:    512,
      description:   'Superior FastAPI backend served via Mangum',
      environment: {
        ...sharedEnv,
        USER_POOL_ID:      userPoolId,
        COGNITO_CLIENT_ID: userPoolClientId,
      },
    });

    apiFunction.addToRolePolicy(fullDynamoPolicy);
    apiFunction.addToRolePolicy(secretsPolicy);

    // ── Sync Lambda ───────────────────────────────────────────────────────────

    const syncFunction = new PythonPoetryFunction(this, 'SyncFunction', {
      functionName: `superior-sync-${stage.name}`,
      entry:        backendDir,
      handler:      'sync.handler.handler',
      timeout:      Duration.seconds(300),
      memorySize:   256,
      description:  'Daily Plaid + Coinbase balance sync triggered by EventBridge',
      environment:  sharedEnv,
    });

    syncFunction.addToRolePolicy(syncDynamoPolicy);
    syncFunction.addToRolePolicy(secretsPolicy);

    // ── EventBridge daily sync schedule ──────────────────────────────────────

    const syncRule = new events.Rule(this, 'DailySyncRule', {
      ruleName:    `superior-daily-sync-${stage.name}`,
      description: 'Daily balance refresh at 6 AM UTC',
      schedule:    events.Schedule.cron({ minute: '0', hour: '6' }),
    });
    syncRule.addTarget(new targets.LambdaFunction(syncFunction));

    // ── API Gateway ───────────────────────────────────────────────────────────

    const userPool = cognito.UserPool.fromUserPoolId(this, 'ImportedUserPool', userPoolId);

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools:  [userPool],
      authorizerName:    `superior-authorizer-${stage.name}`,
      identitySource:    'method.request.header.Authorization',
    });

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName:   `superior-api-${stage.name}`,
      description:   `Superior API (${stage.name})`,
      deployOptions: { stageName: stage.name },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
      },
    });

    const integration = new apigateway.LambdaIntegration(apiFunction);
    const methodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    api.root.addMethod('ANY', integration, methodOptions);
    api.root.addResource('{proxy+}').addMethod('ANY', integration, methodOptions);

    // ── Stack outputs ─────────────────────────────────────────────────────────

    this.apiUrl = api.url;

    new CfnOutput(this, 'ApiUrl', {
      value:       api.url,
      description: 'API Gateway endpoint URL',
      exportName:  `superior-api-url-${stage.name}`,
    });

    new CfnOutput(this, 'ApiFunctionArn', {
      value:       apiFunction.functionArn,
      description: 'API Lambda Function ARN',
    });

    new CfnOutput(this, 'SyncFunctionArn', {
      value:       syncFunction.functionArn,
      description: 'Sync Lambda Function ARN',
    });
  }
}
