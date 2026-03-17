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

## Edit content without touching app logic

These files are meant for manual updates:

- `/Users/kiranpalatasingh/Documents/New project/content.js`
  Use this for homepage text, About page text, footer text, section headings, and button labels.

- `/Users/kiranpalatasingh/Documents/New project/curation.js`
  Use this for:
  - Book of the Week
  - featured authors
  - homepage shelves
  - quick themes

- `/Users/kiranpalatasingh/Documents/New project/book-overrides.js`
  Use this for manual book-level overrides such as:
  - `summary`
  - `whyItStandsOut`
  - `authorSpotlight`

## Resize boxes and elements

Open `/Users/kiranpalatasingh/Documents/New project/styles.css` and edit the CSS variables at the top:

- `--hero-gap`
- `--hero-padding`
- `--hero-title-max`
- `--hero-title-size`
- `--book-card-cover-height`
- `--detail-cover-height`
- `--panel-padding`
- `--card-padding`

Those variables control most of the big layout and sizing decisions without needing to search through the whole stylesheet.

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
