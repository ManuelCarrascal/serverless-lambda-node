const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqsClient = new SQSClient({});

exports.createUser = async (event) => {
  try {
    const { name, email } = JSON.parse(event.body);

    if (!name || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Name and email are required" })
      };
    }

    const id = uuidv4();

    await docClient.send(new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: { id, name, email }
    }));
    // Enviar mensaje a SQS para que otra Lambda lo procese
    const sqsParams = {
      QueueUrl: process.env.SQS_QUEUE_URL, // 🔹 Asegúrate de definir esta variable en el `serverless.yml`
      MessageBody: JSON.stringify({ id, name, email })
    };

    await sqsClient.send(new SendMessageCommand(sqsParams));


    return {
      statusCode: 201,
      body: JSON.stringify({ id, name, email })
    };
  } catch (error) {
    console.error("Internal error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal error",
        error: error.message || "Unknown error"
      })
    };
  }
};
