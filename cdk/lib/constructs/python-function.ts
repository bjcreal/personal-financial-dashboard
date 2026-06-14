import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PythonPoetryFunctionProps extends Omit<lambda.FunctionProps, 'runtime' | 'code'> {
  /**
   * Absolute path to the directory containing pyproject.toml.
   * This entire directory is bundled as the Lambda package.
   */
  readonly entry: string;
}

/**
 * A Lambda function that packages Python dependencies via Poetry.
 *
 * At synth/deploy time, CDK spins up a Docker container matching the Lambda
 * runtime (python3.13), runs `poetry export | pip install` inside it, and
 * zips the result. The runtime Python version is always python3.13 — change
 * the `runtime` property here to update both the bundling image and the
 * deployed runtime in one place.
 */
export class PythonPoetryFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: PythonPoetryFunctionProps) {
    const { entry, ...rest } = props;

    super(scope, id, {
      ...rest,
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(entry, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_13.bundlingImage,
          command: [
            'bash',
            '-c',
            [
              'pip install --quiet poetry',
              'poetry export --without-hashes --without=dev -f requirements.txt | pip install --quiet -r /dev/stdin -t /asset-output',
              'cp -r /asset-input/. /asset-output/',
            ].join(' && '),
          ],
        },
      }),
    });
  }
}
