Forked from aws-samples/aws-elastic-beanstalk-express-js-sample.

This repository holds the **application**: source, unit tests, Dockerfile and
the Jenkinsfile that builds it. The Jenkins environment that runs the pipeline
is defined separately in https://github.com/Ashini98K/isec6000-jenkins-compose.

The split is deliberate — application code changes many times a day and is
built by anyone with commit access, while the CI configuration defines *who*
may run those builds and with what privileges. Different change rate,
different review requirements.

# AWS Elastic Beanstalk Node.js Sample App

This repository contains a sample Node.js web application built using [Express](https://expressjs.com/), meant to be used as part of the AWS DevOps Learning Path.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

