1. make a new tab in /dashboard called File Manager (this will be a file manager for all user files that are uploaded, since user upload are tied to their id /account it should be easy to implement this)
2. add a storage system for users (free = 10MB of total storage, starter = 100MB of storage, pro = 300MB of storage)

this will be displayed on the file manager page and also on the user account page.

all user file uploaded will be displayed in the file manager page and how many storage left can also be seen there

though, under /dashboard, there's a left sidebar, we can put the storage info there as well, so users can always see how much storage they have left when they are in the dashboard

3. under billing we need to chnage price, starter is $9 and pro is $19
4. add a feedback button on the editor on top right corner on the header and connect it to the the admin panel at /dev/admin, there's already a tab for feedback management there
5. under /dashboard/security we'll only need to activate change password if we detect user are sign in using email and not google /github, and under there we should display connected accounts so user knows if they user different login method, I think we'll need to change our DB too if we implement this since 1 user can have different login method, but idk about different emails, just search how ppl or platform handle this, or the easiest way is to just display 1 account connected and the other greyed out.
6. under /dashboard/world we have enter editor button, I want it to be also displayed as a single block beside system explorer card / header on the right side as a square block with a map icon, and when user click on it, it will also enter the editor, this is for user to easily access the editor without going to the world tab first.
7. lastly we need to make multiple theme, right now we can just add dark and ligth theme, make sure it's really nice and working