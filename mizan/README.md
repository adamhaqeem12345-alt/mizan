# mizan/

Data and scripts for Mizan's Shariah rules:

- `data/sc-shariah-list-<date>.json`: the SC Shariah Advisory Council list,
  imported from the official PDF.
- `scripts/import-sc-list.mjs`: turns `pdftotext -raw` output into that JSON.
- `scripts/sync-sim-prices.mjs`: loads the latest Bursa closes into the
  desktop simulator account.

See the [main README](../README.md) for how Mizan works, how to run it and how
to update the SC list.
