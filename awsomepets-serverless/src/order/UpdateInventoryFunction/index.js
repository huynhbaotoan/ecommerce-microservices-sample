const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const inventoryTable = process.env.CATALOGUE_TABLE;

class ErrUpdateInventory extends Error {
  constructor(message) {
    super(message);
    this.name = "ErrUpdateInventory";
  }
}

exports.handler = async (event, context) => {
  var order = event;
  console.log("UpdateInventoryFunction Input is:" + JSON.stringify(order));

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
          ConditionExpression: "#stock >= :val",
          UpdateExpression: "SET #stock = #stock - :val",
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
    /*[
      {
        ConditionCheck: {
          TableName: inventoryTable,
          Key:{
            "id": "81ad9dae-3f63-4e64-baac-a984dfc2fb28"
          },
          ConditionExpression: "itemsInStock >= :val",
          //UpdateExpression: "SET itemsInStock = :val",
          //ExpressionAttributeNames: {
          //  "#stock":"itemsInStock"
          //},
          ExpressionAttributeValues:{
            ":val" : 1
          },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD"
        }
      }]*/
  };

  // Put in database
  try {
    await ddb.transactWrite(params).promise();
  } catch(e) {
    console.log(e);
    throw new ErrUpdateInventory("Error updating inventory")
  }

  order.status = "reserved";
  return order;
};
