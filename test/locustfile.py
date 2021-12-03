from locust import HttpUser, task

class AwsomeStoredUser(HttpUser):
    @task
    def place_order(self):
        data =  {
            "basket": [
                {
                "id": "81ad9dae-3f63-4e64-baac-a984dfc2fb28",
                "quantity": 1,
                "title": "T-Shirt"
                }
            ],
            "shippingAddress": {
                "address": "1 Some Street",
                "city": "Somewhere",
                "postCode": "1234"
            },
            "paymentDetail": {
                "cardNumber": "4111111111111111",
                "cardholderName": "Test Person",
                "expiry": "12/22",
                "ccv": "123"
            }
        }
        
        self.client.post("/v1/ordertest", json=data)