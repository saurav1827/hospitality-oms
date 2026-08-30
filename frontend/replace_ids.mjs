import fs from 'fs';
import path from 'path';

const searchDir = path.join(process.cwd(), 'app', '(dashboard)');
const propertyIdRegex = /const propertyId = '00000000-0000-0000-0000-000000000001'/g;
const propertyIdReplacement = `const { data: sessionData } = useSWR(['session'], () => graphqlRequest(sessionQuery));\n  const propertyId = sessionData?.session?.propertyId || '';\n  if (!propertyId) return <div>Loading context...</div>;`;

const locationIdRegex = /const locationId = '00000000-0000-0000-0000-000000000002'/g;
const locationIdReplacement = `const { data: locationData } = useSWR(['locations', propertyId], ([, id]) => graphqlRequest(locationsQuery, { propertyId: id }));\n  const locationId = locationData?.locations?.[0]?.id || '';\n  if (!locationId) return <div>Loading location context...</div>;`;

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            if (content.includes("const propertyId = '00000000-0000-0000-0000-000000000001'")) {
                if (fullPath.includes('layout.tsx')) {
                    // Custom logic for layout
                    content = content.replace(propertyIdRegex, "const propertyId = user?.propertyId || ''");
                } else {
                    content = content.replace(propertyIdRegex, propertyIdReplacement);
                    // Make sure sessionQuery is imported if we are using it
                    if (!content.includes('sessionQuery')) {
                        content = content.replace('graphqlRequest,', 'graphqlRequest, sessionQuery,');
                        if (!content.includes('sessionQuery')) {
                            // If it wasn't replaced, add it manually
                             content = content.replace(/import { graphqlRequest(.*?) } from '@\/lib\/graphql-client'/, "import { graphqlRequest$1, sessionQuery } from '@/lib/graphql-client'");
                        }
                    }
                }
                modified = true;
            }

            if (content.includes("const locationId = '00000000-0000-0000-0000-000000000002'")) {
                 content = content.replace(locationIdRegex, locationIdReplacement);
                 // Make sure locationsQuery is imported
                 if (!content.includes('locationsQuery')) {
                     content = content.replace(/import { graphqlRequest(.*?) } from '@\/lib\/graphql-client'/, "import { graphqlRequest$1, locationsQuery } from '@/lib/graphql-client'");
                 }
                 modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDir(searchDir);
console.log('Done replacing hardcoded IDs.');
