const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { SNSClient, ListSubscriptionsByTopicCommand, SubscribeCommand } = require("@aws-sdk/client-sns");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const sqsClient = new SQSClient({});
const snsClient = new SNSClient({});

exports.createUser = async (event) => {
  try {
    const { name, email } = JSON.parse(event.body);
    if (!name || !email) {
      return { statusCode: 400, body: JSON.stringify({ message: "Name and email are required" }) };
    }

    const id = uuidv4();

    await docClient.send(new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: { id, name, email }
    }));

    // Enviar mensaje a SQS para que otra Lambda lo procese
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({ id, name, email })
    }));

    // Verificar si el email ya está suscrito a SNS
    const listSubsResponse = await snsClient.send(new ListSubscriptionsByTopicCommand({
      TopicArn: process.env.SNS_TOPIC_ARN
    }));

    const isAlreadySubscribed = listSubsResponse.Subscriptions.some(sub => sub.Endpoint === email && sub.SubscriptionArn !== "PendingConfirmation");

    if (!isAlreadySubscribed) {
      await snsClient.send(new SubscribeCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Protocol: "email",
        Endpoint: email,
      }));
      console.log(`Suscripción enviada a ${email}, revisa tu correo para confirmar.`);
    } else {
      console.log(`El email ${email} ya está suscrito a SNS.`);
    }

    return {
      statusCode: 201,
      body: JSON.stringify({ id, name, email, message: "User created. If not subscribed, check email for SNS confirmation." })
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