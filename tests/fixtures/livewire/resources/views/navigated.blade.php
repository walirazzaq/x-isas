@extends('layouts.app')

@section('content')
    <main class="mx-auto max-w-5xl" data-testid="navigated-page">
        <span x-is="badge" color="success" data-testid="navigated-badge">Reinitialized after navigation</span>
        <a href="{{ route('contract') }}" wire:navigate data-testid="navigate-back">Back to contract</a>
    </main>
@endsection
