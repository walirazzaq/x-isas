<?php

return [
    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => false,
            'throw' => false,
        ],

        'tmp-for-tests' => [
            'driver' => 'local',
            'root' => storage_path('app/livewire-tmp'),
            'serve' => false,
            'throw' => false,
        ],
    ],

    'links' => [],
];
