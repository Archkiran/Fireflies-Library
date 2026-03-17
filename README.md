# Library Shelf

A lightweight offline-friendly library catalog web app built with plain HTML, CSS, and JavaScript.

## Features

- Browse books as visual cards with cover-style artwork
- Search by title, author, genre, and tags
- Filter by genre and availability status
- View shelf location, ISBN, copies, and summary in a details panel
- Works without a backend so it can be opened directly in a browser
- Supports real local cover images through the `coverImage` field
- Loads the live catalog from `books-data.js`

## Run locally

Open `/Users/kiranpalatasingh/Documents/New project/index.html` in a browser.

## Customize the catalog

The current catalog was imported from:

- `/Users/kiranpalatasingh/Downloads/Fireflies_Library_Catalog_Enhanced.xlsx`

The app reads book records from:

- `/Users/kiranpalatasingh/Documents/New project/books-data.js`

If you replace the spreadsheet later, I can regenerate `books-data.js` again.

Each book supports:

- `catalogCode`
- `title`
- `author`
- `genre`
- `language`
- `publisher`
- `status`
- `location`
- `published`
- `isbn`
- `copies`
- `translator`
- `condition`
- `donatedBy`
- `borrowedBy`
- `borrowDate`
- `returnDate`
- `notes`
- `coverImage`
- `summary`
- `tags`

For offline cover images, place image files in this project folder and point `coverImage`
to them, for example `./covers/the-hobbit.jpg`.
