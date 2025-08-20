const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const { spawn } = require('child_process');

/* ----------------------------------------- */
/*  Compile sass
/* ----------------------------------------- */

const SIMPLE_SASS = ['styles/**/*.scss'];
function compileSass() {
	return gulp.src('./styles/daggerheart.scss').pipe(sass().on('error', sass.logError)).pipe(gulp.dest('./styles'));
}

const DOCS_SASS = ['documentation/sass/**/*.scss'];
function compileDocSass() {
	return gulp
		.src('./documentation/sass/custom.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./documentation/docs/overrides/assets/stylesheets/'));
}
/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
	gulp.watch(SIMPLE_SASS, compileSass);
}

function watchDocs() {
	gulp.watch(DOCS_SASS, compileDocSass);
}

function mkdocs() {
	try {
		console.log('Starting mkdocs');
		const mk = spawn('mkdocs', ['serve']);

		// Handle output for mkdocs
		mk.stdout.on('data', data => {
			console.log(`[MkDocs] : ${data}`);
		});
		mk.stderr.on('data', data => {
			console.error(`[MkDocs] : ${data}`);
		});
	} catch (e) {}
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

module.exports = {
	default: gulp.series(gulp.parallel(compileSass), watchUpdates),
	css: compileSass,
	docs: gulp.parallel(gulp.series(gulp.parallel(compileDocSass), watchDocs), mkdocs),
};
