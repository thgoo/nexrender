'use strict';

const path = require('path');
const fs = require('fs-extra');
const async = require('async');

function getAllExpressions(data) {
    let regex = /evalFile\(\"([\S\s]*?)\"\)/gi;
    return regex.exec(data);
}

/**
 * This function tries to find and replace path to a data/script file
 * via regular expressions
 * It will match paths looking something like that:
 *     "/Users/Name/Projects/MyProject/"
 *     "C:\\Projects\\MyNewProject\\"
 *     "/usr/var/tmp/projects/123/"
 *
 * And will replace them to string `dst`
 */
function replacePath(src, dst) {
    return src.replace(
        /(?:(?:[A-Z]\:|~){0,1}(?:\/|\\\\|\\)(?=[^\s\/]))(?:(?:[\ a-zA-Z0-9\+\-\_\.\$\●\-]+(?:\/|\\\\|\\)))*/gm,
        dst
    );
}

function processTemplateFile(project, callback) {
    // project file template name
    let projectName = path.join(project.workpath, project.template);
    let replaceToPath = path.join(process.cwd(), project.workpath, path.sep); // absolute path

    // escape single backslash to double in win
    replaceToPath = replaceToPath.replace(/\\/g, '\\\\');

    // read project file contents
    fs.readFile(projectName, (err, bin) => {
        if (err) return callback(err);

        // convert to utf8 string
        let data = bin.toString('utf8');

        // check for valid project template
        if (data.indexOf('<?xml') !== 0) return callback(new Error('Project is not valid xml project template'));

        // search for expressions
        let expressions = getAllExpressions(data);

        delete expressions[0];
        // check for existing expressions
        if (expressions !== null) {
            // then iterate over them
            for (let expr of expressions) {
                if(!expr) continue;

                // replace old path with the new one
                let newExpr = replacePath(expr, replaceToPath);

                // replace patched hex
                data = data.replace(expr, newExpr);
            }
        }

        // save result
        fs.writeFile(projectName, data, callback);
    });
}

/**
 * This task patches project
 * and replaces all the paths to srcripts
 * to ones that provided in project
 */
module.exports = function(project) {
    return new Promise((resolve, reject) => {
        console.info(`[${project.uid}] patching project...`);

        // Iterate over assets,
        // skip those that are not data/script files,
        for (let asset of project.assets) {
            if (['script', 'data'].indexOf(asset.type) === -1) continue;

            return processTemplateFile(project, err => {
                return err ? reject(err) : resolve(project);
            });
        }

        // project contains no data/script assets, pass
        resolve(project);
    });
};
