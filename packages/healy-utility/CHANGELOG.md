# Change Log

All notable changes to this project will be documented in this file.
See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="2.0.1"></a>
## 2.0.1 (2019-01-31)


### Bug Fixes

* **error-reporter:** support arrays of types ([02b5eaf](https://github.com/SupportClass/healy/commit/02b5eaf))
* **gdrive:** add support for Team Drives ([b30d293](https://github.com/SupportClass/healy/commit/b30d293))
* **healy-utility:** fix case where having a sheet named "metadata" would break the metadata replicant ([1a72609](https://github.com/SupportClass/healy/commit/1a72609))
* **package:** use fast-deep-equal instead of deep-equal ([cb04f40](https://github.com/SupportClass/healy/commit/cb04f40))
* **project-import:** avoid potential stacking race condition ([8cffe5f](https://github.com/SupportClass/healy/commit/8cffe5f))


### Features

* **healy-utility:** add `entrantType`, `entrantIdPath`, and `entrantLabelPath` to all `team` and `player` objects ([c3ea8b5](https://github.com/SupportClass/healy/commit/c3ea8b5))
* **healy-utility:** add returnHash option to cache get endpoint ([ac476b8](https://github.com/SupportClass/healy/commit/ac476b8))
* **healy-utility:** add support for specifying a replicant processor ([cbbe534](https://github.com/SupportClass/healy/commit/cbbe534))
* **healy-utility:** add support for tournament groups ([558bc98](https://github.com/SupportClass/healy/commit/558bc98))
* **healy-utility:** expose list of error types ([5335f06](https://github.com/SupportClass/healy/commit/5335f06))
* **healy-utility:** greatly improve the simplicity and reliability of validation error formatting ([9d07e5b](https://github.com/SupportClass/healy/commit/9d07e5b))
* **healy-utility:** ignore sheets prefixed with an underscore ([854f57e](https://github.com/SupportClass/healy/commit/854f57e))


### BREAKING CHANGES

* **healy-utility:** `entrantType`, `entrantIdPath`, and `entrantLabelPath` properties have been added to all `team` and `player` objects. At a minimum, this will require updates to the relevant schemas of the consuming bundle.



<a name="1.0.1"></a>
## 1.0.1 (2018-03-09)



<a name="1.0.0"></a>
# 1.0.0 (2018-03-09)



<a name="1.0.0-24"></a>
# 1.0.0-24 (2018-01-18)



<a name="1.0.0-23"></a>
# 1.0.0-23 (2018-01-18)


### Bug Fixes

* **healy-utility:** fix error messages in add-to-cache argument validation ([838e8b0](https://github.com/SupportClass/healy/commit/838e8b0))


### Features

* **healy-utility:** add support for running in a zeit pkg'd distribution of NodeCG ([64077bd](https://github.com/SupportClass/healy/commit/64077bd))



<a name="1.0.0-22"></a>
# 1.0.0-22 (2017-10-15)


### Bug Fixes

* **healy-utility:** include user_id in a wider range of validations ([ba9e3d1](https://github.com/SupportClass/healy/commit/ba9e3d1))



<a name="1.0.0-21"></a>
# 1.0.0-21 (2017-10-15)


### Bug Fixes

* **healy-utility:** include user_id when reporting player validation errors ([c66fa0d](https://github.com/SupportClass/healy/commit/c66fa0d))



<a name="1.0.0-19"></a>
# 1.0.0-19 (2017-10-14)


### Bug Fixes

* **gdrive:** don't error when an image processing job has no sheet to run against ([a620b57](https://github.com/SupportClass/healy/commit/a620b57))



<a name="1.0.0-18"></a>
# 1.0.0-18 (2017-10-12)


### Features

* **healy-utility:** add integerNoCoercion and floatNoCoercion casts ([7f67eb6](https://github.com/SupportClass/healy/commit/7f67eb6))



<a name="1.0.0-17"></a>
# 1.0.0-17 (2017-10-11)


### Bug Fixes

* **healy-utility:** actually ignore _ columns ([b42b5c8](https://github.com/SupportClass/healy/commit/b42b5c8))
* **package:** remove unused sharp dependency ([82184c6](https://github.com/SupportClass/healy/commit/82184c6))



<a name="1.0.0-16"></a>
# 1.0.0-16 (2017-10-11)


### Bug Fixes

* **digest-workbook:** prevent error when there are no players in the sheet ([8bcf0f5](https://github.com/SupportClass/healy/commit/8bcf0f5))


### Features

* **digest-workbook:** ignore columns which start with an underscore (_) ([75d17c3](https://github.com/SupportClass/healy/commit/75d17c3))



<a name="1.0.0-15"></a>
# 1.0.0-15 (2017-10-07)


### Bug Fixes

* **digest-workbook:** ignore columns that have no title ([fffff56](https://github.com/SupportClass/healy/commit/fffff56))



<a name="1.0.0-14"></a>
# 1.0.0-14 (2017-10-06)


### Bug Fixes

* **healy-utility:** make the "reprocess images" functionality actually behave as expected ([32d4d0f](https://github.com/SupportClass/healy/commit/32d4d0f))



<a name="1.0.0-12"></a>
# 1.0.0-12 (2017-09-10)


### Bug Fixes

* **healy-utility:** clone values before assigning to reps, to ensure no objects are shared between reps ([e1b36ac](https://github.com/SupportClass/healy/commit/e1b36ac))



<a name="1.0.0-11"></a>
# 1.0.0-11 (2017-09-09)


### Bug Fixes

* **digest-workbook:** support NOT_FOUND values in JSON columns ([44535ac](https://github.com/SupportClass/healy/commit/44535ac))



<a name="1.0.0-10"></a>
# 1.0.0-10 (2017-08-04)


### Bug Fixes

* **healy-utility:** fix isCached method throwing an error when searching for a variant that is not found ([9458c9b](https://github.com/SupportClass/healy/commit/9458c9b))
* **healy-utility:** fix metadata not being updated when first importing a google sheet ([204b17d](https://github.com/SupportClass/healy/commit/204b17d))


### Features

* **healy-utility:** add Reprocess Cache and Clear Cache buttons. Fix google projects not processing images. Fix several other small image processing issues and simplify some of the config. ([f367c2c](https://github.com/SupportClass/healy/commit/f367c2c))



<a name="1.0.0-7"></a>
# 1.0.0-7 (2017-07-31)



<a name="1.0.0-6"></a>
# 1.0.0-6 (2017-07-27)



<a name="1.0.0-5"></a>
# 1.0.0-5 (2017-07-20)



<a name="1.0.0-4"></a>
# 1.0.0-4 (2017-07-20)



<a name="1.0.0-3"></a>
# 1.0.0-3 (2017-07-19)



<a name="1.0.0-2"></a>
# 1.0.0-2 (2017-07-18)



<a name="1.0.0-1"></a>
# 1.0.0-1 (2017-07-18)



<a name="1.0.0-0"></a>
# 1.0.0-0 (2017-07-18)




<a name="2.0.0"></a>
# [2.0.0](https://github.com/SupportClass/healy/compare/v2.0.0-dev.4...v2.0.0) (2018-10-30)




**Note:** Version bump only for package healy-utility

<a name="1.0.1"></a>
## [1.0.1](https://github.com/SupportClass/healy/compare/v1.0.0...v1.0.1) (2018-03-09)




**Note:** Version bump only for package healy-utility
