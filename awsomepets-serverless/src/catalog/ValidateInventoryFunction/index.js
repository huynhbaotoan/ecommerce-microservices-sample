const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const catalogueTable = process.env.CATALOGUE_TABLE;

class ErrValidateInventory extends Error {
  constructor(message) {
    super(message);
    this.name = "ErrValidateInventory";
  }
}

exports.handler = async (event) => {
  let response = null;
  var order = event;
  console.log("ValidateInventoryFunction Input is:" + JSON.stringify(order));
  
  var expressionAttributeValues = {};
  let filtedConditionWithQuantity = "";
  
  for(let i=0;i<order.basket.length; i++) {
    let item = order.basket[i];
    
    //preapre for query
    let keyName = ":item" + (i + 1);
    expressionAttributeValues[keyName] = item.id;
    let valueName = ":value" + (i + 1);
    expressionAttributeValues[valueName] = item.quantity;
    if( i > 0)
      filtedConditionWithQuantity += " OR ";
    filtedConditionWithQuantity += " (id = " + keyName + " AND itemsInStock < " + valueName + ") ";


  }

  var params = {
    TableName : catalogueTable,
    FilterExpression: filtedConditionWithQuantity,
    ExpressionAttributeValues: expressionAttributeValues
  }

  try {
    let result = await ddb.scan(params).promise();

    if(result.Items.length > 0)
      response = {
        statusCode: 400,
        status: "failed",
        items: result.Items
      };
    else
    {
      response = {
        statusCode: 202,
        status: "reserved"
      };
    }
  } catch(e) {
    console.log(e);
    response = {
      statusCode: 400,
      status: "failed",
      message: "Unable to validate items in the inventory."
    };
    throw new ErrValidateInventory("Error validating inventory")
  }

  return response;
};
