import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SuperiorStack } from '../lib/stacks/superior-stack';
import { resolveStage } from '../lib/config';

const app = new cdk.App();

const stageName = app.node.tryGetContext('stage') ?? process.env.STAGE ?? 'prod';
const stage = resolveStage(stageName);

new SuperiorStack(app, `superior-${stage.name}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: `Superior application infrastructure (${stage.name})`,
  tags: {
    Project:     'superior',
    Stage:       stage.name,
    ManagedBy:   'cdk',
  },
});
