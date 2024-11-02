# 9c-monitor


**https://snxn2iiokwfhaj7rwmrbtd6kt40siufc.lambda-url.ap-northeast-2.on.aws/** (교체 예정)

![image](https://github.com/user-attachments/assets/fde71ffb-decf-49d8-97d7-74686c6592d9)

## Installation

```bash
$ npm install
```

## Running the app

```bash
# watch mode
$ npm run start:dev
```

## Deployment
```
$ export AWS_PROFILE=gamefi-dev-poweruser
$ aws configure

$ rm -rf ~/.aws/cli/cache
$ aws sts get-caller-identity
로 assumeRole 되었는지 확인
되었다면

$ cd ~/.aws/cli/cache
$ FILE_NAME=$(grep -rl 'AccessKeyId' .)
$ export AWS_ACCESS_KEY_ID=$(jq -r '.Credentials.AccessKeyId' < "$FILE_NAME") 
$ export AWS_SECRET_ACCESS_KEY=$(jq -r '.Credentials.SecretAccessKey' < "$FILE_NAME") 
$ export AWS_SESSION_TOKEN=$(jq -r '.Credentials.SessionToken' < "$FILE_NAME")
$ unset AWS_PROFILE
$ cd ~/9c-monitor
$ serverless deploy  (serverless login이 되어있다고 가정)
```

## Stack
- Backend: Nest.js, AWS Lambda (Serverless)
- Frontend: HTML, CSS, JS

## Etc
기여 사항 및 성과
- Serverless 아키텍처로 비용 절감: Nest.js를 활용해 서버리스(Serverless) 아키텍처로 AWS Lambda에 배포하여 서비스 유지 비용을 효과적으로 절감.
- ... 기재 예정
- https://in-seo.tistory.com/entry/실-서비스를-Nestjs-Serverless-Lambda로-배포해보자
- https://in-seo.tistory.com/entry/Serverless-배포시에-MFA인증-하기