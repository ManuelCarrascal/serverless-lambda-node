const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const snsClient = new SNSClient({});

exports.sendEmail = async (event) => {
	try {
	  console.log("Mensajes recibidos de SQS:", JSON.stringify(event, null, 2));
  
	  const publishPromises = event.Records.map(async (record) => {
		const { name, email } = JSON.parse(record.body);
  
		const params = {
		  Message: `Hola ${name}, gracias por registrarte en nuestra plataforma.`,
		  Subject: "¡Registro exitoso!",
		  TopicArn: process.env.SNS_TOPIC_ARN
		};
  
		await snsClient.send(new PublishCommand(params));
		console.log(`Correo enviado a ${email} a través de SNS.`);
	  });
  
	  await Promise.allSettled(publishPromises);
  
	  return {
		statusCode: 200,
		body: JSON.stringify({ message: "Mensajes procesados correctamente" })
	  };
	} catch (error) {
	  console.error("Error al enviar correos:", error);
	  return {
		statusCode: 500,
		body: JSON.stringify({ message: "Error al procesar los mensajes", error: error.message })
	  };
	}
  };