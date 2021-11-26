const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const catalogueTable = process.env.CATALOGUE_TABLE;
const inventoryTable = process.env.INVENTORY_TABLE;

class ErrValidateInventory extends Error {
  constructor(message) {
    super(message);
    this.name = "ErrValidateInventory";
  }
}

exports.handler = async (event, context) => {
  let response = null;
  var order = event;
  console.log("ValidateInventoryFunction Input is:" + JSON.stringify(order));
  
  var expressionAttributeValues = {};
  let expressionAttributeValuesOnlyIds = {};
  let filtedConditionWithQuantity = "";
  const orderId = event.orderId != null ? event.orderId : context.awsRequestId;
  let bookedConditionWithQuantity = "";
  let ids = {};
  
  for(let i=0;i<order.basket.length; i++) {
    let item = order.basket[i];
    
    //prepare for query, get all items from the list
    let keyName = ":item" + (i + 1);
    expressionAttributeValues[keyName] = item.id;
    expressionAttributeValuesOnlyIds[keyName] = item.id;
    let valueName = ":value" + (i + 1);
    //expressionAttributeValues[valueName] = item.quantity;
    if( i > 0)
      filtedConditionWithQuantity += " OR ";
    filtedConditionWithQuantity += " (id = " + keyName + ") ";// AND itemsInStock < " + valueName + ") ";

    //build query to get all booking if have
    if( i > 0)
      bookedConditionWithQuantity += " OR ";
    bookedConditionWithQuantity += " (sk = " + keyName + ") ";
    
    //keep to detect previous booking
    ids[item.id] = item.quantity;
  }

  var params = {
    TableName : catalogueTable,
    FilterExpression: filtedConditionWithQuantity,
    ConsistentRead: true,
    ExpressionAttributeValues: expressionAttributeValues
  }

  var reservedParams = {
    TableName : inventoryTable,
    FilterExpression: bookedConditionWithQuantity,
    ConsistentRead: true,
    ExpressionAttributeValues: expressionAttributeValuesOnlyIds
  }

  try {
    let result = await ddb.scan(params).promise();
    let bookings = await ddb.scan(reservedParams).promise();
    
    let bookingQuantity = {};
    let bookingTransactions = [];
    let bookingTransactionMap = {};
    let transactionDate = Date.now();
    let minutesToAdd = 10;
    let ttlDate = transactionDate + minutesToAdd * 60;
    
    bookings.Items.forEach(item => {
      if(event.orderId != null && item.orderId === event.orderId) {
        if(item.quantity != ids[item.sk]) {
          bookingTransactionMap[item.sk] = {
            Update: {
              TableName: inventoryTable,
                Key:{
                  "id": orderId
                },
                UpdateExpression: "SET #stock = :val",
                ExpressionAttributeNames: {
                  "#stock":"quantity"
                },
                ExpressionAttributeValues:{
                  ":val" : ids[item.sk]
                },
                ReturnValuesOnConditionCheckFailure: "ALL_OLD"
            }
          };
        }
      }
      else
        bookingQuantity[item.sk] += item.quantity;
    });
    
    let orderItems = [];
    result.Items.forEach(item => {
      if(item.itemsInStock < ids[item.id])
        orderItems.push(item);
    });

    if(orderItems.length > 0)
      response = {
        statusCode: 400,
        status: "failed",
        items: orderItems
      };
    else
    {
      //insert into inventoryTbl table
      Object.keys(ids).map((key, index) => {
        if(bookingTransactionMap[key] != null)
          bookingTransactions.push(bookingTransactionMap[key]);
        else {
          bookingTransactions.push({
            Put: {
              TableName: inventoryTable,
              Item: {
                orderId: orderId,
                sk: key,
                quantity: ids[key],
                transactionDate: transactionDate,
                ttl: ttlDate
              },
              ReturnValuesOnConditionCheckFailure: "NONE"
            }
          });
        }
      });
      
      let writingParams = {
        TransactItems: bookingTransactions
      };
      await ddb.transactWrite(writingParams).promise();
      response = {
        statusCode: 202,
        orderId: orderId,
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
