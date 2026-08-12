<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'contract')->name('contract');
Route::view('/navigated', 'navigated')->name('navigated');
