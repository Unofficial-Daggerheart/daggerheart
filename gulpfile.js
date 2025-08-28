const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const { spawn } = require('child_process');

/* ----------------------------------------- */
/*  Compile sass
/* ----------------------------------------- */

const UO_SASS = ['styles/**/*.scss'];
const DOCS_SASS = ['documentation/sass/**/*.scss'];

function compileSassUOv1() {
	return gulp
		.src('./styles/src/daggerheart.v1.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./styles'));
}
function compileSassUOv2() {
	return gulp
		.src('./styles/src/daggerheart.v2.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./styles'));
}

function compileSassDocs() {
	return gulp
		.src('./documentation/sass/custom.scss')
		.pipe(sass().on('error', sass.logError))
		.pipe(gulp.dest('./documentation/docs/overrides/assets/stylesheets/'));
}

/* ----------------------------------------- */
/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
	gulp.watch(UO_SASS, gulp.series(compileSassUOv1, compileSassUOv2));
}

function watchDocs() {
	gulp.watch(DOCS_SASS, compileSassDocs);
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
	default: gulp.series(gulp.parallel(gulp.series(compileSassUOv1, compileSassUOv2)), watchUpdates),
	css: gulp.series(compileSassUOv1, compileSassUOv2),
	docs: gulp.parallel(gulp.series(gulp.parallel(gulp.series(compileSassUOv1, compileSassUOv2)), watchDocs), mkdocs),
};
