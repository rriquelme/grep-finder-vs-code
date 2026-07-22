// scripts/migrate.js — one-off migration script (plain JS, no types).

// TODO: unify rounding across services (grep-finder demo).
function calculateInvoiceTotal(rows) {
  var subtotal = 0;
  for (var i = 0; i < rows.length; i++) {
    subtotal += rows[i].amount;
  }
  // rounding: legacy script rounds to whole units.
  return Math.round(subtotal);
}

function run(allRows) {
  console.log('processing invoice batch');
  var migrated = calculateInvoiceTotal(allRows);
  console.log('migrated total:', migrated);
}

module.exports = { calculateInvoiceTotal, run };
