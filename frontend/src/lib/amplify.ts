/**
 * AWS Amplify configuration.
 *
 * Values are populated from environment variables set in Amplify Console
 * (or .env.local for local development).
 *
 * After deploying via SAM, copy the Outputs from the CloudFormation stack:
 *   - UserPoolId  → NEXT_PUBLIC_COGNITO_USER_POOL_ID
 *   - UserPoolClientId → NEXT_PUBLIC_COGNITO_CLIENT_ID
 */
import { Amplify } from "aws-amplify";

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        loginWith: {
          email: true,
        },
      },
    },
  });
}
