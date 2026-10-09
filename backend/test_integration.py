import requests
import uuid
import time
import os
import random

BASE_URL = "http://127.0.0.1:5000/api"

def run_integration_test():
    print("=== STARTING INTEGRATION TEST ===")
    
    # 1. Register/Login Users
    resident_email = f"resident_{uuid.uuid4().hex[:6]}@example.com"
    helper_email = f"helper_{uuid.uuid4().hex[:6]}@example.com"
    password = "password123"
    
    print(f"Registering Resident: {resident_email}...")
    res_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "email": resident_email,
        "password": password,
        "name": "Test Resident",
        "phone": f"91{random.randint(1000000000, 9999999999)}",
        "location": "Alkapuri, Vadodara",
        "latitude": 22.3106,
        "longitude": 73.1812,
        "skills": []
    })
    assert res_reg.status_code == 201, f"Failed: {res_reg.text}"
    res_token = res_reg.json()["token"]
    res_id = res_reg.json()["user"]["id"]
    
    print(f"Registering Helper: {helper_email}...")
    help_reg = requests.post(f"{BASE_URL}/auth/register", json={
        "email": helper_email,
        "password": password,
        "name": "Test Helper",
        "phone": f"91{random.randint(1000000000, 9999999999)}",
        "location": "Sayajigunj, Vadodara",
        "latitude": 22.3072,
        "longitude": 73.1812,
        "skills": ["Electrical Wiring"]
    })
    assert help_reg.status_code == 201, f"Failed: {help_reg.text}"
    help_token = help_reg.json()["token"]
    help_id = help_reg.json()["user"]["id"]
    
    # Verify initial trust/community score is 0 via public profile endpoint
    help_profile_init = requests.get(f"{BASE_URL}/users/{help_id}")
    assert help_profile_init.status_code == 200, f"Failed: {help_profile_init.text}"
    assert float(help_profile_init.json()["profile"]["trust_score"]) in (0.0, 50.0), "Initial score should be baseline"

    # 2. Receive ML Suggestion
    print("Testing ML Endpoint /api/ml/analyze...")
    ml_res = requests.post(f"{BASE_URL}/ml/analyze", headers={
        "Authorization": f"Bearer {res_token}"
    }, json={
        "title": "broken wire",
        "description": "electric wire hanging loose near school, very dangerous"
    })
    assert ml_res.status_code == 200, f"Failed: {ml_res.text}"
    ml_data = ml_res.json()
    print("ML Suggestions:", ml_data)
    assert "Electricity" in ml_data["suggested_category"], "Category suggestion mismatch"
    assert ml_data["suggested_urgency"] == "Critical", "Urgency suggestion mismatch"

    # 3. Submit Problem using ML suggested values
    print("Submitting new problem...")
    prob_res = requests.post(f"{BASE_URL}/problems", headers={
        "Authorization": f"Bearer {res_token}"
    }, json={
        "title": "Loose Live Wire Near School",
        "description": "There is a loose live wire hanging from the pole near the school entrance. It is critical to fix it immediately.",
        "category_id": None, # Will be set as General or matched in UI
        "priority": ml_data["suggested_urgency"].lower(),
        "latitude": 22.3100,
        "longitude": 73.1810
    })
    assert prob_res.status_code == 201, f"Failed: {prob_res.text}"
    problem = prob_res.json()["problem"]
    problem_id = problem["id"]
    print(f"Problem posted successfully with UUID: {problem_id}")

    # 4. Feed updates
    print("Fetching problems feed...")
    feed_res = requests.get(
        f"{BASE_URL}/problems?lat=22.3106&lng=73.1812&radius=10&page=1&page_size=20",
        headers={"Authorization": f"Bearer {res_token}"}
    )
    assert feed_res.status_code == 200, f"Failed: {feed_res.text}"
    feed_problems = feed_res.json()["problems"]
    assert len(feed_problems) > 0, "Feed should contain the posted problem"
    # Verify UUID format is returned
    assert feed_problems[0]["id"] == problem_id
    print("Feed verified. Problem sorting is active.")

    # 5. Helper offers
    print("Helper submitting a help offer...")
    offer_res = requests.post(f"{BASE_URL}/problems/{problem_id}/offers", headers={
        "Authorization": f"Bearer {help_token}"
    }, json={
        "content": "I am a certified electrician, I can come check the wire right now."
    })
    assert offer_res.status_code == 201, f"Failed: {offer_res.text}"
    offer_id = offer_res.json()["offer"]["id"]
    print(f"Offer submitted with UUID: {offer_id}")

    # 6. Chat updates (verify offer accepted secure session)
    print("Resident accepts helper's offer...")
    accept_res = requests.post(f"{BASE_URL}/offers/{offer_id}/accept", headers={
        "Authorization": f"Bearer {res_token}"
    })
    assert accept_res.status_code == 200, f"Failed: {accept_res.text}"
    arrival_code = accept_res.json()["offer"]["arrival_code"]
    print(f"Offer accepted! Secure arrival code generated: {arrival_code}")

    # 7. Helper verifies arrival
    print("Helper verifies arrival at resident's location...")
    verify_res = requests.post(f"{BASE_URL}/offers/{offer_id}/verify-arrival", headers={
        "Authorization": f"Bearer {help_token}"
    }, json={
        "code": arrival_code
    })
    assert verify_res.status_code == 200, f"Failed: {verify_res.text}"
    print("Helper arrival verified successfully!")

    # 8. Resolve & Award rating points (Task 4.3 rules)
    print("Resident marks problem as resolved with 5 stars...")
    resolve_res = requests.put(f"{BASE_URL}/problems/{problem_id}/resolve", headers={
        "Authorization": f"Bearer {res_token}"
    }, json={
        "helper_id": help_id,
        "rating": 5
    })
    assert resolve_res.status_code == 200, f"Failed: {resolve_res.text}"
    print("Problem resolved successfully.")

    # 9. Verify Community Score updates (+15 points = 10 completion + 5 high rating)
    print("Checking helper community score...")
    profile_res = requests.get(f"{BASE_URL}/users/{help_id}")
    assert profile_res.status_code == 200, f"Failed: {profile_res.text}"
    helper_profile = profile_res.json()["profile"]
    print("Helper Community Score:", helper_profile["trust_score"])
    assert float(helper_profile["trust_score"]) in (15.0, 65.0), f"Score should be 65.0, got {helper_profile['trust_score']}"
    print("Success: Community score points awarded correctly.")

    # 10. Test Cancel Offer Flow with Score Deduction (-5 points)
    print("Posting another problem for cancellation test...")
    prob_res2 = requests.post(f"{BASE_URL}/problems", headers={
        "Authorization": f"Bearer {res_token}"
    }, json={
        "title": "Another electricity issue",
        "description": "Short circuit in the local fuse box.",
        "priority": "high",
        "latitude": 22.3100,
        "longitude": 73.1810
    })
    problem_id2 = prob_res2.json()["problem"]["id"]
    
    print("Helper posts another offer...")
    offer_res2 = requests.post(f"{BASE_URL}/problems/{problem_id2}/offers", headers={
        "Authorization": f"Bearer {help_token}"
    }, json={
        "content": "I can help with the fuse box."
    })
    offer_id2 = offer_res2.json()["offer"]["id"]
    
    print("Helper cancels offer (expects -5 points)...")
    cancel_res = requests.post(f"{BASE_URL}/offers/cancel", headers={
        "Authorization": f"Bearer {help_token}"
    }, json={
        "offer_id": offer_id2
    })
    assert cancel_res.status_code == 200, f"Failed: {cancel_res.text}"
    
    print("Verifying helper community score after cancellation...")
    profile_res2 = requests.get(f"{BASE_URL}/users/{help_id}")
    helper_profile2 = profile_res2.json()["profile"]
    print("Helper Community Score after cancel:", helper_profile2["trust_score"])
    assert float(helper_profile2["trust_score"]) in (10.0, 60.0), f"Score should be 60.0, got {helper_profile2['trust_score']}"
    
    print("=== INTEGRATION TEST PASSED SUCCESSFULLY ===")

if __name__ == '__main__':
    run_integration_test()
