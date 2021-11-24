const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const inventoryTable = process.env.CATALOGUE_TABLE;

class ErrReleaseInventory extends Error {
  constructor(message) {
    super(message);
    this.name = "ErrReleaseInventory";
  }
}

exports.handler = async (event, context) => {
  var order = event;
  console.log("ReleaseInventoryNewFunction Input is:" + JSON.stringify(order));

  // Update inventory and save to catalog table
  let orderItems = [];
  let transactionDate = Date.now();
  for(let i=0;i<order.basket.length; i++) {
    let item = order.basket[i];

    orderItems.push({
      Update: {
        TableName: inventoryTable,
          Key:{
            "id": item.id
          },
          UpdateExpression: "SET #stock = #stock + :val",
          ExpressionAttributeNames: {
            "#stock":"itemsInStock"
          },
          ExpressionAttributeValues:{
            ":val" : item.quantity
          },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD"
      }
    });
  }

  let params = {
    TransactItems: orderItems
  };

  // Put in database
  try {
    await ddb.transactWrite(params).promise();
  } catch(e) {
    console.log(e);
    throw new ErrUpdateInventory("Error releasing inventory")
  }

  order.status = "released";
  return order;
};
