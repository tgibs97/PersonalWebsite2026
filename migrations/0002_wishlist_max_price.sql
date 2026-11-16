-- "Don't pay over": the most Trent wants anyone to spend on an item. Optional (null = no limit).
ALTER TABLE wishlist_items ADD COLUMN max_cents INTEGER;
