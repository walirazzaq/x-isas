<!doctype html>
<html lang="en" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>x-isas Livewire contract fixture</title>
    @livewireStyles
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-base-200 p-5">
    <nav class="mx-auto mb-6 flex max-w-5xl gap-3" aria-label="Fixture navigation">
        <a href="{{ route('contract') }}" wire:navigate data-testid="contract-link">Contract</a>
        <a href="{{ route('navigated') }}" wire:navigate data-testid="navigate-link">Navigate</a>
    </nav>

    @yield('content')

    <div id="fixture-portal"></div>
    @livewireScripts
</body>
</html>
