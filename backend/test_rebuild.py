import requests
import uuid
import time

BASE_URL = "http://127.0.0.1:5000/api"

def run_rebuild_tests():
    print("=== STARTING SAMANVI HYPERLOCAL REBUILD TESTS ===")

    # Generate unique test accounts
    user_a_email = f"usera_{uuid.uuid4().hex[:6]}@example.com"
    user_b_email = f"userb_{uuid.uuid4().hex[:6]}@example.com"
    password = "password123"

    # Coordinates details:
    # Vadodara - Alkapuri (User A): 22.3106, 73.1812
    # Ahmedabad - Vastrapur (User B - ~100km away): 23.0338, 72.5250
    # Vadodara - Sayajigunj (User B's relocation - ~1.5km from A): 22.3072, 73.1812

    # 1. Register User A in Vadodara
    print("\n[1] Registering User A in Vadodara...")
    reg_a = requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_a_email,
        "password": password,
        "name": "User A (Vadodara)",
        "phone": "9876543220",
        "location": "Alkapuri, Vadodara",
        "latitude": 22.3106,
        "longitude": 73.1812,
        "skills": []
    })
    assert reg_a.status_code == 201, f"Failed A registration: {reg_a.text}"
    token_a = reg_a.json()["token"]
    id_a = reg_a.json()["user"]["id"]
    print("User A registered successfully.")

    # 2. Register User B in Ahmedabad (> 10km away)
    print("\n[2] Registering User B in Ahmedabad (~100km away)...")
    reg_b = requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_b_email,
        "password": password,
        "name": "User B (Ahmedabad)",
        "phone": "9876543221",
        "location": "Vastrapur, Ahmedabad",
        "latitude": 23.0338,
        "longitude": 72.5250,
        "skills": []
    })
    assert reg_b.status_code == 201, f"Failed B registration: {reg_b.text}"
    token_b = reg_b.json()["token"]
    id_b = reg_b.json()["user"]["id"]
    print("User B registered successfully.")

    # 3. User A posts a problem in Vadodara (free_help post type)
    print("\n[3] User A posting a free help request in Vadodara...")
    post_res = requests.post(f"{BASE_URL}/problems", headers={
        "Authorization": f"Bearer {token_a}"
    }, json={
        "title": "Water Pipe Leakage",
        "description": "Clean water is leaking from the main inlet pipeline near the apartment gate.",
        "category": "Water",
        "priority": "medium",
        "latitude": 22.3106,
        "longitude": 73.1812,
        "post_type": "free_help"
    })
    assert post_res.status_code == 201, f"Failed posting problem: {post_res.text}"
    problem_id = post_res.json()["problem"]["id"]
    print(f"Problem posted successfully (ID: {problem_id}).")

    # 4. Assert Home-location-locked feed boundaries
    print("\n[4] Asserting feed lock boundaries...")
    
    # User B (Ahmedabad) fetches the feed. It should NOT contain User A's problem.
    feed_b = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_b}"})
    assert feed_b.status_code == 200, f"Failed fetching feed B: {feed_b.text}"
    problems_b = feed_b.json()["problems"]
    matched_b = [p for p in problems_b if p["id"] == problem_id]
    assert len(matched_b) == 0, "Security violation: Ahmedabad user saw Vadodara feed!"
    print("Verified: Ahmedabad User B cannot view Vadodara problem.")

    # User A (Vadodara) fetches the feed. It SHOULD contain the problem.
    feed_a = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_a}"})
    assert feed_a.status_code == 200, f"Failed fetching feed A: {feed_a.text}"
    problems_a = feed_a.json()["problems"]
    matched_a = [p for p in problems_a if p["id"] == problem_id]
    assert len(matched_a) == 1, "Vadodara User A failed to view local problem!"
    print("Verified: Vadodara User A can view the local problem.")

    # 5. Relocation request & approval workflow
    print("\n[5] Testing Relocation Workflow...")
    
    # User B requests relocation to Sayajigunj, Vadodara (22.3072, 73.1812)
    req_reloc = requests.post(f"{BASE_URL}/users/request-relocation", headers={
        "Authorization": f"Bearer {token_b}"
    }, json={
        "new_lat": 22.3072,
        "new_lon": 73.1812,
        "reason": "Transferred job to Vadodara branch"
    })
    assert req_reloc.status_code == 200, f"Failed relocation request: {req_reloc.text}"
    req_id = req_reloc.json()["request_id"]
    print(f"Relocation request filed successfully (ID: {req_id}).")

    # Admin (User A acts as admin here) approves relocation request
    approve_res = requests.post(f"{BASE_URL}/admin/relocation/{req_id}/approve", headers={
        "Authorization": f"Bearer {token_a}"
    })
    assert approve_res.status_code == 200, f"Failed relocation approval: {approve_res.text}"
    print("Relocation request approved by admin.")

    # Now, User B fetches feed. It should now contain User A's Vadodara problem!
    feed_b_new = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_b}"})
    assert feed_b_new.status_code == 200, f"Failed fetching feed: {feed_b_new.text}"
    problems_b_new = feed_b_new.json()["problems"]
    matched_b_new = [p for p in problems_b_new if p["id"] == problem_id]
    assert len(matched_b_new) == 1, "Relocated user failed to view the new community feed!"
    print("Verified: Relocated User B can now view Vadodara community feed.")

    # 6. Block workflow
    print("\n[6] Testing User Blocking...")
    
    # User A blocks User B
    block_res = requests.post(f"{BASE_URL}/users/block/{id_b}", headers={
        "Authorization": f"Bearer {token_a}"
    })
    assert block_res.status_code == 200, f"Failed blocking user: {block_res.text}"
    print("User A blocked User B.")

    # Verify User B is in User A's blocked list
    blocked_list = requests.get(f"{BASE_URL}/users/blocked", headers={
        "Authorization": f"Bearer {token_a}"
    })
    assert blocked_list.status_code == 200, f"Failed fetching blocked list: {blocked_list.text}"
    blocked_users = blocked_list.json()["blocked_users"]
    assert any(u["id"] == id_b for u in blocked_users), "Blocked user B not in A's blocked list!"
    print("Verified: User B is in User A's blocked list.")

    # Since User A blocked User B, User B should no longer see User A's problems in the feed!
    feed_b_blocked = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_b}"})
    problems_b_blocked = feed_b_blocked.json()["problems"]
    matched_b_blocked = [p for p in problems_b_blocked if p["id"] == problem_id]
    assert len(matched_b_blocked) == 0, "Security violation: Blocked User B saw A's problem!"
    print("Verified: Blocked User B cannot view User A's problems in feed.")

    # User A unblocks User B
    unblock_res = requests.delete(f"{BASE_URL}/users/block/{id_b}", headers={
        "Authorization": f"Bearer {token_a}"
    })
    assert unblock_res.status_code == 200, f"Failed unblocking user: {unblock_res.text}"
    print("User A unblocked User B.")

    # 7. Token revoking / Logout blacklist
    print("\n[7] Testing token blacklisting on logout...")
    
    # Logout User A
    logout_res = requests.post(f"{BASE_URL}/auth/logout", headers={
        "Authorization": f"Bearer {token_a}"
    })
    assert logout_res.status_code == 200, f"Failed logout: {logout_res.text}"
    print("User A logged out.")

    # Try to access problems with blacklisted token
    feed_a_blacklisted = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_a}"})
    assert feed_a_blacklisted.status_code == 401, f"Security fail: Blacklisted token accessed API! {feed_a_blacklisted.text}"
    print("Verified: Blacklisted token rejected with 401 Unauthorized.")

    # 8. Test 1km boundary enforcement
    print("\n[8] Testing 1km boundary enforcement...")
    user_c_email = f"userc_{uuid.uuid4().hex[:6]}@example.com"
    user_d_email = f"userd_{uuid.uuid4().hex[:6]}@example.com"
    user_e_email = f"usere_{uuid.uuid4().hex[:6]}@example.com"
    
    # User C acts as poster at Alkapuri center (22.3107, 73.1839)
    reg_c = requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_c_email,
        "password": password,
        "name": "User C (Alkapuri)",
        "phone": "9876543222",
        "location": "Alkapuri",
        "latitude": 22.3107,
        "longitude": 73.1839,
        "skills": []
    })
    assert reg_c.status_code == 201
    token_c = reg_c.json()["token"]
    
    # User C posts a problem at Alkapuri (22.3107, 73.1839)
    post_c = requests.post(f"{BASE_URL}/problems", headers={
        "Authorization": f"Bearer {token_c}"
    }, json={
        "title": "Alkapuri Leakage",
        "description": "Pipe leaking",
        "category": "Water",
        "priority": "medium",
        "latitude": 22.3107,
        "longitude": 73.1839,
        "post_type": "free_help"
    })
    assert post_c.status_code == 201
    prob_c_id = post_c.json()["problem"]["id"]
    
    # User D registers 1.5km away (22.3230, 73.1839) - outside 1km boundary
    reg_d = requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_d_email,
        "password": password,
        "name": "User D (1.5km away)",
        "phone": "9876543223",
        "location": "Outside Alkapuri",
        "latitude": 22.3230,
        "longitude": 73.1839,
        "skills": []
    })
    assert reg_d.status_code == 201
    token_d = reg_d.json()["token"]
    
    # User D fetches feed - should NOT see User C's problem
    feed_d = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_d}"})
    assert feed_d.status_code == 200
    problems_d = feed_d.json()["problems"]
    matched_d = [p for p in problems_d if p["id"] == prob_c_id]
    assert len(matched_d) == 0, "Security violation: User 1.5km away saw feed!"
    print("[OK] User 1.5km away correctly excluded")
    
    # User E registers 0.5km away (22.3152, 73.1839) - inside 1km boundary
    reg_e = requests.post(f"{BASE_URL}/auth/register", json={
        "email": user_e_email,
        "password": password,
        "name": "User E (0.5km away)",
        "phone": "9876543224",
        "location": "Near Alkapuri",
        "latitude": 22.3152,
        "longitude": 73.1839,
        "skills": []
    })
    assert reg_e.status_code == 201
    token_e = reg_e.json()["token"]
    
    # User E fetches feed - SHOULD see User C's problem
    feed_e = requests.get(f"{BASE_URL}/problems", headers={"Authorization": f"Bearer {token_e}"})
    assert feed_e.status_code == 200
    problems_e = feed_e.json()["problems"]
    matched_e = [p for p in problems_e if p["id"] == prob_c_id]
    assert len(matched_e) == 1, "User 0.5km away failed to view problem!"
    print("[OK] User 0.5km away correctly included")
    print("[OK] 1km boundary working correctly")

    print("\n=== ALL SAMANVI HYPERLOCAL REBUILD TESTS PASSED! ===")

if __name__ == '__main__':
    run_rebuild_tests()
