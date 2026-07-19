from automation.config import get_supabase

def update_nfr():
    supabase = get_supabase()
    res = supabase.from_("notifications").select("id, title").ilike("title", "%NFR%").execute()
    if not res.data:
        print("NFR record not found!")
        return

    n_id = res.data[0]["id"]
    print("Updating NFR record ID:", n_id)

    update_res = supabase.from_("notifications").update({
        "apply_start_date": "2026-07-20",
        "apply_end_date": "2026-08-19",
        "vacancy_count": 6777
    }).eq("id", n_id).execute()

    print("Update result:", update_res.data)

if __name__ == "__main__":
    update_nfr()
