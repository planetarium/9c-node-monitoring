import axios from 'axios';

interface LambdaEvent {
  body: string;
}

export const handler = async (event: LambdaEvent) => {
    const { groupName, rpcEndpoints, timeStamp } = JSON.parse(event.body);
  
    if (!rpcEndpoints || !Array.isArray(rpcEndpoints)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or missing rpcEndpoints' }),
      };
    }
  
    const startTime = Date.now();
    try {
      const EC2_API_URL = 'http://3.136.106.225:3000/api/send-tx';
      const payload = { groupName, rpcEndpoints, timeStamp };
  
      // EC2로 요청 전송
      const response = await axios.post(EC2_API_URL, payload, {
        timeout: 120000,
      });
  
      const { data } = response;
      if (data.status !== 'SUCCESS') {
        console.error(`Transaction failed: ${data.error}`);
      } else {
        console.log(`Transaction succeeded: ${data.response}`);
      }
  
      console.log(`Request succeeded in ${Date.now() - startTime}ms`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Transaction successfully sent to EC2.',
          response: data,
        }),
      };
    } catch (error) {
      console.error(`Request failed after ${Date.now() - startTime}ms`, error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to send transaction to EC2.',
          details: error.message,
        }),
      };
    }
  };