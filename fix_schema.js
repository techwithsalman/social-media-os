const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Replace multiple instances back to a single one.
schema = schema.replace(/facebookAutoDmRules       FacebookAutoDmRule\[\]\n  facebookAutoDmExecutions  FacebookAutoDmExecution\[\]\n  facebookAutoDmRules       FacebookAutoDmRule\[\]\n  facebookAutoDmExecutions  FacebookAutoDmExecution\[\]/g, 'facebookAutoDmRules       FacebookAutoDmRule[]\n  facebookAutoDmExecutions  FacebookAutoDmExecution[]');

// And check if there are 2 sets of them
schema = schema.replace(/facebookAutoDmRules FacebookAutoDmRule\[\]\n  facebookAutoDmExecutions FacebookAutoDmExecution\[\]\n  facebookAutoDmRules FacebookAutoDmRule\[\]\n  facebookAutoDmExecutions FacebookAutoDmExecution\[\]/g, 'facebookAutoDmRules FacebookAutoDmRule[]\n  facebookAutoDmExecutions FacebookAutoDmExecution[]');

fs.writeFileSync('prisma/schema.prisma', schema);
