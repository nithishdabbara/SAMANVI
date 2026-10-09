import requests

BASE_URL = 'http://127.0.0.1:5000'

if __name__ == '__main__':
    print("--- Testing User Registration ---")
    reg_res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": "testuser@samanviapp.com",
        "password": "securepassword123",
        "name": "Samanvi Tester",
        "phone": "9876543210"
    })
    print("Status:", reg_res.status_code)
    try:
        print("Response:", reg_res.json())
    except:
        print("Raw Body:", reg_res.text)

    print("\n--- Testing User Login ---")
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "testuser@samanviapp.com",
        "password": "securepassword123"
    })
    print("Status:", login_res.status_code)
    try:
        print("Response:", login_res.json())
    except:
        print("Raw Body:", login_res.text)
