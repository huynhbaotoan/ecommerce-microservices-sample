const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const catalogueTable = process.env.CATALOGUE_TABLE;


exports.handler = async (event) => {

  var params = {
    TableName : catalogueTable,
    FilterExpression: "itemsInStock > :numberOfStock",
    ExpressionAttributeValues: {
         ":numberOfStock": 0
    }
  }

  try {
    console.log("Test");
    let result = await ddb.scan(params).promise();
    return result.Items;
  } catch(e) {
    console.log(e);
  }

  return null;
};
